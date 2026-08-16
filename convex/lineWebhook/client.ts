import { getLineIntegrationMode } from "../lineLink/model";
import type { LineImageContent } from "../../lib/domain/lineImage/content";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const LINE_CONTENT_ENDPOINT_PREFIX = "https://api-data.line.me/v2/bot/message/";
const PROVIDER_TIMEOUT_MS = 10_000;
const MAX_REPLY_TEXT_LENGTH = 5_000;
const MAX_MESSAGE_ID_LENGTH = 256;

export const MOCK_LINE_IMAGE_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

export const LINE_UNLINKED_GUIDANCE_MESSAGE =
  "LINE連携が必要です。kakeiboのWeb設定からLINE連携を完了してください。";

export type LineFetch = typeof fetch;

export async function sendLineTextReply(
  replyToken: string,
  text: string,
  fetchImpl: LineFetch = fetch,
): Promise<void> {
  if (!replyToken || replyToken.length > 2048) {
    throw new Error("LINE reply token is invalid");
  }
  if (!text || text.length > MAX_REPLY_TEXT_LENGTH) {
    throw new Error("LINE reply text is invalid");
  }

  const mode = getLineIntegrationMode();
  if (mode === "mock") return;

  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE messaging integration is unavailable");

  let response: Response;
  try {
    response = await fetchImpl(LINE_REPLY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
  } catch {
    throw new Error("LINE messaging provider is unavailable");
  }

  if (!response.ok) throw new Error("LINE messaging provider rejected the reply");
}

export async function getLineMessageContent(
  messageId: string,
  fetchImpl: LineFetch = fetch,
): Promise<LineImageContent> {
  if (!messageId || messageId.length > MAX_MESSAGE_ID_LENGTH || messageId.trim().length === 0) {
    throw new Error("LINE message id is invalid");
  }

  const mode = getLineIntegrationMode();
  if (mode === "mock") {
    return { bytes: MOCK_LINE_IMAGE_BYTES, contentType: "image/jpeg" };
  }

  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE messaging integration is unavailable");

  let response: Response;
  try {
    response = await fetchImpl(
      `${LINE_CONTENT_ENDPOINT_PREFIX}${encodeURIComponent(messageId)}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
  } catch {
    throw new Error("LINE messaging provider is unavailable");
  }

  if (!response.ok) throw new Error("LINE messaging provider rejected the content request");

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType };
}

import { getLineIntegrationMode } from "../lineLink/model";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const PROVIDER_TIMEOUT_MS = 10_000;

export const LINE_UNLINKED_GUIDANCE_MESSAGE =
  "LINE連携が必要です。kakeiboのWeb設定からLINE連携を完了してください。";

export type LineFetch = typeof fetch;

export async function sendLineTextReply(
  replyToken: string,
  fetchImpl: LineFetch = fetch,
): Promise<void> {
  if (!replyToken || replyToken.length > 2048) {
    throw new Error("LINE reply token is invalid");
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
        messages: [{ type: "text", text: LINE_UNLINKED_GUIDANCE_MESSAGE }],
      }),
    });
  } catch {
    throw new Error("LINE messaging provider is unavailable");
  }

  if (!response.ok) throw new Error("LINE messaging provider rejected the reply");
}

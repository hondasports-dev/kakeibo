import { httpAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { parseLineWebhookPayload, LineWebhookPayloadError } from "./model";
import { verifyLineSignature } from "./signature";

export const MAX_RAW_BODY_BYTES = 1_000_000;

export type LineSignatureVerifier = (
  rawBody: string,
  signature: string,
  channelSecret: string,
) => Promise<boolean>;

export type ScheduleUnlinkedGuide = (ctx: ActionCtx, replyToken: string) => Promise<void>;

const scheduleUnlinkedGuide: ScheduleUnlinkedGuide = async (ctx, replyToken) => {
  await ctx.scheduler.runAfter(0, internal.lineWebhook.actions.sendUnlinkedGuide, {
    replyToken,
  });
};

export function createLineWebhookHandler(
  verifySignature: LineSignatureVerifier = verifyLineSignature,
  scheduleGuide: ScheduleUnlinkedGuide = scheduleUnlinkedGuide,
): ReturnType<typeof httpAction> {
  return httpAction(async (ctx, req) => {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_RAW_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413 });
    }
    const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
    if (!channelSecret) return new Response("Webhook unavailable", { status: 500 });

    const signature = req.headers.get("x-line-signature");
    if (!signature) return new Response("Unauthorized", { status: 401 });

    let validSignature = false;
    try {
      validSignature = await verifySignature(rawBody, signature, channelSecret);
    } catch {
      validSignature = false;
    }
    if (!validSignature) return new Response("Unauthorized", { status: 401 });

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    let events;
    try {
      events = parseLineWebhookPayload(payload);
    } catch (error) {
      if (error instanceof LineWebhookPayloadError) {
        return new Response("Bad Request", { status: 400 });
      }
      return new Response("Bad Request", { status: 400 });
    }

    const result: {
      claimedCount: number;
      duplicateCount: number;
      guideReplies: Array<{ replyToken: string }>;
    } = await ctx.runMutation(internal.lineWebhook.internal.claimEvents, { events });
    for (const { replyToken } of result.guideReplies) {
      await scheduleGuide(ctx, replyToken);
    }

    return new Response("ok", { status: 200 });
  });
}

export const lineWebhookHandler = createLineWebhookHandler();

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { sendLineTextReply, LINE_UNLINKED_GUIDANCE_MESSAGE } from "./client";

const GUIDE_RETRY_DELAY_MS = 1_000;
const MAX_GUIDE_RETRIES = 2;

export async function sendUnlinkedGuideHandler(
  ctx: ActionCtx,
  args: { replyToken: string; attempt?: number },
) {
  const attempt = args.attempt ?? 0;
  try {
    await sendLineTextReply(args.replyToken);
  } catch {
    if (attempt < MAX_GUIDE_RETRIES) {
      await ctx.scheduler.runAfter(
        GUIDE_RETRY_DELAY_MS,
        internal.lineWebhook.actions.sendUnlinkedGuide,
        {
          replyToken: args.replyToken,
          attempt: attempt + 1,
        },
      );
    }
  }
  return null;
}

export const sendUnlinkedGuide = internalAction({
  args: { replyToken: v.string(), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: sendUnlinkedGuideHandler,
});

export { LINE_UNLINKED_GUIDANCE_MESSAGE };

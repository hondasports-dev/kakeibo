import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { sendLineTextReply, LINE_UNLINKED_GUIDANCE_MESSAGE } from "./client";

export async function sendUnlinkedGuideHandler(_ctx: ActionCtx, args: { replyToken: string }) {
  await sendLineTextReply(args.replyToken);
  return null;
}

export const sendUnlinkedGuide = internalAction({
  args: { replyToken: v.string() },
  returns: v.null(),
  handler: sendUnlinkedGuideHandler,
});

export { LINE_UNLINKED_GUIDANCE_MESSAGE };

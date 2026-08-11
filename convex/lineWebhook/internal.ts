import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { lineWebhookEventInputValidator, MAX_EVENTS_PER_REQUEST } from "./model";

export const claimEvents = internalMutation({
  args: {
    events: v.array(lineWebhookEventInputValidator),
  },
  returns: v.object({
    claimedCount: v.number(),
    duplicateCount: v.number(),
    guideReplies: v.array(v.object({ replyToken: v.string() })),
  }),
  handler: async (ctx, args) => {
    if (args.events.length > MAX_EVENTS_PER_REQUEST) {
      throw new ConvexError("Too many LINE webhook events");
    }

    let claimedCount = 0;
    let duplicateCount = 0;
    const guideReplies: Array<{ replyToken: string }> = [];

    for (const event of args.events) {
      // 既存データに重複があってもWebhook再送処理自体は継続できるようfirstを使う。
      const duplicate = await ctx.db
        .query("lineWebhookEvents")
        .withIndex("by_webhook_event_id", (q) => q.eq("webhookEventId", event.webhookEventId))
        .first();
      if (duplicate) {
        duplicateCount += 1;
        continue;
      }

      const activeLinks = await ctx.db
        .query("lineAccountLinks")
        .withIndex("by_line_user_id_and_status", (q) =>
          q.eq("lineUserId", event.lineUserId).eq("status", "active"),
        )
        .take(2);
      const activeUserIds = new Set(activeLinks.map((link) => link.userId));
      const activeUserId = activeUserIds.size === 1 ? activeLinks[0]?.userId : undefined;
      const now = Date.now();

      if (activeUserId) {
        await ctx.db.insert("lineWebhookEvents", {
          webhookEventId: event.webhookEventId,
          eventType: event.eventType,
          delivery: "linked",
          userId: activeUserId,
          ...(event.messageId === undefined ? {} : { messageId: event.messageId }),
          ...(event.messageText === undefined ? {} : { messageText: event.messageText }),
          ...(event.postbackData === undefined ? {} : { postbackData: event.postbackData }),
          ...(event.eventTimestamp === undefined ? {} : { eventTimestamp: event.eventTimestamp }),
          createdAt: now,
        });
      } else {
        await ctx.db.insert("lineWebhookEvents", {
          webhookEventId: event.webhookEventId,
          eventType: event.eventType,
          delivery: "unlinked",
          createdAt: now,
        });
        if (event.replyToken) guideReplies.push({ replyToken: event.replyToken });
      }
      claimedCount += 1;
    }

    return { claimedCount, duplicateCount, guideReplies };
  },
});

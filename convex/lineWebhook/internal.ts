import type { Id } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { MAX_CATEGORIES_PER_GROUP } from "../../lib/domain/categories/defaults";
import { resolveLineEventCommandText } from "../../lib/domain/lineSummary/commands";
import { resolveActiveGroupForUserId } from "../groups/membership";
import {
  lineImageJobStatusValidator,
  lineImageSkipReasonValidator,
  lineWebhookEventInputValidator,
  MAX_EVENTS_PER_REQUEST,
} from "./model";

export const claimEvents = internalMutation({
  args: {
    events: v.array(lineWebhookEventInputValidator),
  },
  returns: v.object({
    claimedCount: v.number(),
    duplicateCount: v.number(),
    scheduledGuideCount: v.number(),
    scheduledSummaryCount: v.number(),
    scheduledImageCount: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.events.length > MAX_EVENTS_PER_REQUEST) {
      throw new ConvexError("Too many LINE webhook events");
    }

    let claimedCount = 0;
    let duplicateCount = 0;
    let scheduledGuideCount = 0;
    let scheduledSummaryCount = 0;
    let scheduledImageCount = 0;
    const seenEventIds = new Set<string>();

    for (const event of args.events) {
      if (seenEventIds.has(event.webhookEventId)) {
        duplicateCount += 1;
        continue;
      }
      seenEventIds.add(event.webhookEventId);

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
        const commandText = resolveLineEventCommandText(event);
        if (commandText !== undefined && event.replyToken) {
          await ctx.scheduler.runAfter(0, internal.lineWebhook.actions.sendSummaryReply, {
            replyToken: event.replyToken,
            userId: activeUserId,
            messageText: commandText,
            nowMs: event.eventTimestamp ?? now,
          });
          scheduledSummaryCount += 1;
        }
        if (event.eventType === "image" && event.messageId) {
          await ctx.db.insert("lineImageJobs", {
            webhookEventId: event.webhookEventId,
            userId: activeUserId,
            messageId: event.messageId,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(0, internal.lineWebhook.image.processLinkedImage, {
            replyToken: event.replyToken ?? "",
            userId: activeUserId,
            webhookEventId: event.webhookEventId,
            messageId: event.messageId,
          });
          scheduledImageCount += 1;
        }
      } else {
        await ctx.db.insert("lineWebhookEvents", {
          webhookEventId: event.webhookEventId,
          eventType: event.eventType,
          delivery: "unlinked",
          createdAt: now,
        });
        if (event.replyToken) {
          // claimと予約を同じmutationで行う。予約に失敗した場合はinsertも
          // ロールバックされ、LINE再送時に案内を取りこぼさない。
          await ctx.scheduler.runAfter(0, internal.lineWebhook.actions.sendUnlinkedGuide, {
            replyToken: event.replyToken,
          });
          scheduledGuideCount += 1;
        }
      }
      claimedCount += 1;
    }

    return {
      claimedCount,
      duplicateCount,
      scheduledGuideCount,
      scheduledSummaryCount,
      scheduledImageCount,
    };
  },
});

const imageJobValidator = v.object({
  webhookEventId: v.string(),
  userId: v.string(),
  messageId: v.string(),
  status: lineImageJobStatusValidator,
  skipReason: v.optional(lineImageSkipReasonValidator),
  draftId: v.optional(v.id("aiExpenseDrafts")),
});

export const getImageJob = internalQuery({
  args: { webhookEventId: v.string() },
  returns: v.union(imageJobValidator, v.null()),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_webhook_event_id", (q) => q.eq("webhookEventId", args.webhookEventId))
      .unique();
    if (job === null) return null;
    return {
      webhookEventId: job.webhookEventId,
      userId: job.userId,
      messageId: job.messageId,
      status: job.status,
      ...(job.skipReason === undefined ? {} : { skipReason: job.skipReason }),
      ...(job.draftId === undefined ? {} : { draftId: job.draftId }),
    };
  },
});

const categoryHintValidator = v.object({
  _id: v.id("categories"),
  name: v.string(),
  description: v.optional(v.string()),
});

export const loadImageProcessingContext = internalQuery({
  args: { userId: v.string() },
  returns: v.object({
    hasUniqueActiveLink: v.boolean(),
    hasConsent: v.boolean(),
    groupStatus: v.union(v.literal("resolved"), v.literal("no_group"), v.literal("unresolved")),
    groupId: v.optional(v.id("groups")),
    categories: v.array(categoryHintValidator),
  }),
  handler: async (ctx, args) => {
    return await loadImageProcessingContextHandler(ctx, args.userId);
  },
});

type ImageProcessingContext = {
  hasUniqueActiveLink: boolean;
  hasConsent: boolean;
  groupStatus: "resolved" | "no_group" | "unresolved";
  groupId?: Id<"groups">;
  categories: Array<{ _id: Id<"categories">; name: string; description?: string }>;
};

export async function loadImageProcessingContextHandler(
  ctx: QueryCtx,
  userId: string,
): Promise<ImageProcessingContext> {
  const activeLinks = await ctx.db
    .query("lineAccountLinks")
    .withIndex("by_user_id_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .take(2);
  const hasUniqueActiveLink = activeLinks.length === 1;

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();
  const hasConsent = user?.receiptImageExternalApiConsentAcceptedAt !== undefined;

  const groupResolution = await resolveActiveGroupForUserId(ctx, userId);
  if (groupResolution.status !== "resolved") {
    return {
      hasUniqueActiveLink,
      hasConsent,
      groupStatus: groupResolution.status,
      categories: [],
    };
  }

  const categories = await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_is_active_and_sort_order", (q) =>
      q.eq("groupId", groupResolution.membership.groupId).eq("isActive", true),
    )
    .take(MAX_CATEGORIES_PER_GROUP);

  return {
    hasUniqueActiveLink,
    hasConsent,
    groupStatus: "resolved" as const,
    groupId: groupResolution.membership.groupId,
    categories: categories.map((category) => ({
      _id: category._id,
      name: category.name,
      ...(category.description === undefined ? {} : { description: category.description }),
    })),
  };
}

export const markImageJobSkipped = internalMutation({
  args: {
    webhookEventId: v.string(),
    skipReason: lineImageSkipReasonValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_webhook_event_id", (q) => q.eq("webhookEventId", args.webhookEventId))
      .unique();
    if (job === null || job.status !== "pending") return null;
    await ctx.db.patch(job._id, {
      status: "skipped",
      skipReason: args.skipReason,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markImageJobDrafted = internalMutation({
  args: {
    webhookEventId: v.string(),
    draftId: v.id("aiExpenseDrafts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_webhook_event_id", (q) => q.eq("webhookEventId", args.webhookEventId))
      .unique();
    if (job === null || job.status !== "pending") return null;
    await ctx.db.patch(job._id, {
      status: "drafted",
      draftId: args.draftId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markImageJobFailed = internalMutation({
  args: {
    webhookEventId: v.string(),
    draftId: v.optional(v.id("aiExpenseDrafts")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_webhook_event_id", (q) => q.eq("webhookEventId", args.webhookEventId))
      .unique();
    if (job === null || job.status !== "pending") return null;
    await ctx.db.patch(job._id, {
      status: "failed",
      ...(args.draftId === undefined ? {} : { draftId: args.draftId }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

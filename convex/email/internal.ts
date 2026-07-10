import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

export const getJobById = internalQuery({
  args: { jobId: v.id("transactionalEmailJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const getJobByProviderMessageId = internalQuery({
  args: { providerMessageId: v.string() },
  handler: async (ctx, { providerMessageId }) => {
    return await ctx.db
      .query("transactionalEmailJobs")
      .withIndex("by_provider_message_id", (q) => q.eq("providerMessageId", providerMessageId))
      .unique();
  },
});

export const updateJobForSend = internalMutation({
  args: {
    jobId: v.id("transactionalEmailJobs"),
    providerMessageId: v.string(),
    status: v.literal("sent"),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      providerMessageId: args.providerMessageId,
      status: args.status,
      updatedAt: args.updatedAt,
      nextRetryAt: undefined,
      errorMessage: undefined,
      errorCode: undefined,
    });
  },
});

export const updateJobForRetry = internalMutation({
  args: {
    jobId: v.id("transactionalEmailJobs"),
    status: v.literal("retrying"),
    attemptCount: v.number(),
    nextRetryAt: v.number(),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      attemptCount: args.attemptCount,
      nextRetryAt: args.nextRetryAt,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      updatedAt: args.updatedAt,
    });
  },
});

export const updateJobForFailure = internalMutation({
  args: {
    jobId: v.id("transactionalEmailJobs"),
    status: v.union(v.literal("failed"), v.literal("suppressed")),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      nextRetryAt: undefined,
      updatedAt: args.updatedAt,
    });
  },
});

export const updateJobStatusFromWebhook = internalMutation({
  args: {
    jobId: v.id("transactionalEmailJobs"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("suppressed"),
      v.literal("failed"),
    ),
    lastProviderEventAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      lastProviderEventAt: args.lastProviderEventAt,
      updatedAt: args.updatedAt,
    });
  },
});

export const getLatestWebhookEventForProviderMessageId = internalQuery({
  args: { providerMessageId: v.string() },
  handler: async (ctx, { providerMessageId }) => {
    const events = await ctx.db
      .query("emailWebhookEvents")
      .withIndex("by_provider_message_id_and_event_created_at", (q) =>
        q.eq("providerMessageId", providerMessageId),
      )
      .order("desc")
      .take(1);
    return events[0] ?? null;
  },
});

export const getWebhookEventBySvixId = internalQuery({
  args: { svixId: v.string() },
  handler: async (ctx, { svixId }) => {
    return await ctx.db
      .query("emailWebhookEvents")
      .withIndex("by_svix_id", (q) => q.eq("svixId", svixId))
      .unique();
  },
});

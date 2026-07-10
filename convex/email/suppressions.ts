import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { emailSuppressionReasonValidator } from "./model";
import type { EmailSuppressionReason } from "../../lib/email/model";

export const getSuppressionByNormalizedEmail = internalQuery({
  args: { normalizedEmail: v.string() },
  handler: async (ctx, { normalizedEmail }) => {
    return await ctx.db
      .query("emailSuppressions")
      .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();
  },
});

export async function upsertSuppressionHandler(
  ctx: MutationCtx,
  args: {
    email: string;
    normalizedEmail: string;
    reason: EmailSuppressionReason;
    source?: string;
    providerMessageId?: string;
    createdAt: number;
  },
): Promise<string> {
  const existing = await ctx.db
    .query("emailSuppressions")
    .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", args.normalizedEmail))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      reason: args.reason,
      source: args.source,
      providerMessageId: args.providerMessageId,
      updatedAt: args.createdAt,
    });
    return existing._id;
  }
  return await ctx.db.insert("emailSuppressions", {
    email: args.email,
    normalizedEmail: args.normalizedEmail,
    reason: args.reason,
    source: args.source,
    providerMessageId: args.providerMessageId,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  });
}

export const upsertSuppression = internalMutation({
  args: {
    email: v.string(),
    normalizedEmail: v.string(),
    reason: emailSuppressionReasonValidator,
    source: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: upsertSuppressionHandler,
});

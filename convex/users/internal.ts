import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";

type UpsertUserProfileArgs = {
  userId: string;
  displayName: string;
  email?: string;
};

export async function upsertUserProfileHandler(ctx: MutationCtx, args: UpsertUserProfileArgs) {
  const now = Date.now();
  const email = args.email?.trim().toLowerCase();
  const displayName = args.displayName.trim() || email || "ユーザー";
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", args.userId))
    .unique();

  if (existing === null) {
    await ctx.db.insert("users", {
      userId: args.userId,
      displayName,
      email,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    displayName,
    email: email ?? existing.email,
    updatedAt: now,
  });
}

export const upsertUserProfile = internalMutation({
  args: {
    userId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
  },
  handler: upsertUserProfileHandler,
});

export const getUserIdByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    return user?.userId ?? null;
  },
});

export const getUserById = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
      .unique();
    if (user === null) return null;
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    };
  },
});

export const clearUserMonthlyIncome = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
      .unique();
    if (user === null) return { cleared: false };
    await ctx.db.patch(user._id, { monthlyIncome: undefined, updatedAt: Date.now() });
    return { cleared: true };
  },
});

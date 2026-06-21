import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getIdentityDisplayName, requireAuthenticatedUserId } from "./auth";

/** upsertUser mutation の handler ロジック（テスト用に export） */
export async function upsertUserHandler(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new ConvexError("Not authenticated");
  }

  const userId = identity.tokenIdentifier;
  const email = identity.email?.trim().toLowerCase();
  const now = Date.now();

  // NOTE: by_token_identifier インデックスには Convex の仕様上 unique constraint を付与できない。
  // そのため、複数ドキュメントが挿入されないよう upsertUser の呼び出し元で制御すること。
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  if (existing === null) {
    await ctx.db.insert("users", {
      userId,
      displayName: getIdentityDisplayName(identity),
      email,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(existing._id, {
      displayName: getIdentityDisplayName(identity, existing.displayName),
      email: email ?? existing.email,
      updatedAt: now,
    });
  }
}

/**
 * ログイン後に呼び出す mutation。
 * Clerk identity から users テーブルを upsert する。
 * userId はクライアント引数を信用せず、サーバー側で identity.tokenIdentifier から解決する。
 */
export const upsertUser = mutation({
  args: {},
  handler: upsertUserHandler,
});

export async function acceptReceiptImageExternalApiConsentHandler(ctx: MutationCtx) {
  const userId = await requireAuthenticatedUserId(ctx);

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  if (user === null) {
    throw new ConvexError("User not found");
  }

  const now = Date.now();
  await ctx.db.patch(user._id, {
    receiptImageExternalApiConsentAcceptedAt: user.receiptImageExternalApiConsentAcceptedAt ?? now,
    updatedAt: now,
  });
}

export const acceptReceiptImageExternalApiConsent = mutation({
  args: {},
  handler: acceptReceiptImageExternalApiConsentHandler,
});

/** updateMonthlyIncome mutation の handler ロジック（テスト用に export） */
export async function updateMonthlyIncomeHandler(
  ctx: MutationCtx,
  args: { monthlyIncome: number | null },
) {
  const userId = await requireAuthenticatedUserId(ctx);

  if (args.monthlyIncome !== null) {
    if (args.monthlyIncome < 0 || !Number.isInteger(args.monthlyIncome)) {
      throw new ConvexError("月収入は0以上の整数で入力してください");
    }
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  if (user === null) {
    throw new ConvexError("User not found");
  }

  const now = Date.now();
  await ctx.db.patch(user._id, {
    monthlyIncome: args.monthlyIncome ?? undefined,
    updatedAt: now,
  });
}

export const updateMonthlyIncome = mutation({
  args: {
    monthlyIncome: v.union(v.null(), v.number()),
  },
  handler: updateMonthlyIncomeHandler,
});

/** updateWeeklyDays mutation の handler ロジック（テスト用に export） */
export async function updateWeeklyDaysHandler(
  ctx: MutationCtx,
  args: { weeklyStartDay: number; weeklyEndDay: number },
) {
  const userId = await requireAuthenticatedUserId(ctx);

  if (
    args.weeklyStartDay < 0 ||
    args.weeklyStartDay > 6 ||
    !Number.isInteger(args.weeklyStartDay)
  ) {
    throw new ConvexError("週の開始曜日は0〜6の整数で入力してください");
  }
  if (args.weeklyEndDay < 0 || args.weeklyEndDay > 6 || !Number.isInteger(args.weeklyEndDay)) {
    throw new ConvexError("週の終了曜日は0〜6の整数で入力してください");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  if (user === null) {
    throw new ConvexError("User not found");
  }

  const now = Date.now();
  await ctx.db.patch(user._id, {
    weeklyStartDay: args.weeklyStartDay,
    weeklyEndDay: args.weeklyEndDay,
    updatedAt: now,
  });
}

export const updateWeeklyDays = mutation({
  args: {
    weeklyStartDay: v.number(),
    weeklyEndDay: v.number(),
  },
  handler: updateWeeklyDaysHandler,
});

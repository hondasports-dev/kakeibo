import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireAuthenticatedUserId } from "./auth";

/** getUserProfile query の handler ロジック（テスト用に export） */
export async function getUserProfileHandler(ctx: QueryCtx) {
  const userId = await requireAuthenticatedUserId(ctx);

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  if (user === null) {
    return undefined;
  }

  return {
    monthlyIncome: user.monthlyIncome ?? null,
    weeklyStartDay: user.weeklyStartDay ?? 1,
    weeklyEndDay: user.weeklyEndDay ?? 0,
  };
}

export const getUserProfile = query({
  args: {},
  handler: getUserProfileHandler,
});

export const getAuthenticatedUserId = query({
  args: {},
  handler: async (ctx) => {
    return await requireAuthenticatedUserId(ctx);
  },
});

export async function getReceiptImageConsentHandler(ctx: QueryCtx) {
  const userId = await requireAuthenticatedUserId(ctx);

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  const acceptedAt = user?.receiptImageExternalApiConsentAcceptedAt ?? null;

  return {
    hasAcceptedExternalApiConsent: acceptedAt !== null,
    acceptedAt,
  };
}

export const getReceiptImageConsent = query({
  args: {},
  handler: getReceiptImageConsentHandler,
});

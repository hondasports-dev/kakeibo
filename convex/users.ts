import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";

type AuthContext = Pick<QueryCtx, "auth">;

/** upsertUser mutation の handler ロジック（テスト用に export） */
export async function upsertUserHandler(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new ConvexError("Not authenticated");
  }

  const userId = identity.tokenIdentifier;
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
      displayName: identity.name ?? identity.email ?? "ユーザー",
      email: identity.email ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(existing._id, {
      displayName: identity.name ?? identity.email ?? existing.displayName,
      email: identity.email ?? existing.email,
      updatedAt: now,
    });
  }
}

export type AuthState =
  | {
      isAuthenticated: false;
      userId: null;
    }
  | {
      isAuthenticated: true;
      userId: string;
    };

export function getAuthStateFromIdentity(identity: UserIdentity | null): AuthState {
  if (identity === null) {
    return {
      isAuthenticated: false,
      userId: null,
    };
  }

  return {
    isAuthenticated: true,
    userId: identity.tokenIdentifier,
  };
}

export async function requireAuthenticatedUserId(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new ConvexError("Not authenticated");
  }

  return identity.tokenIdentifier;
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

// ---------------------------------------------------------------------------
// getUserProfile
// ---------------------------------------------------------------------------

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
  };
}

export const getUserProfile = query({
  args: {},
  handler: getUserProfileHandler,
});

// ---------------------------------------------------------------------------
// getReceiptImageConsent
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// acceptReceiptImageExternalApiConsent
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// updateMonthlyIncome
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// clearUserMonthlyIncome (internal / E2E テストデータクリーンアップ専用)
// ---------------------------------------------------------------------------

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

import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";

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

export function getAuthStateFromIdentity(
  identity: UserIdentity | null,
): AuthState {
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

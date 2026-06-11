import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUserId } from "./users";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type GroupMembership = {
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
};

// ---------------------------------------------------------------------------
// 内部ヘルパー: グループメンバーシップ取得
// ---------------------------------------------------------------------------

/**
 * 認証済みユーザーのグループメンバーシップを取得する。
 * グループ未所属の場合は null を返す（throw しない）。
 * データファイルから共通利用するため export する。
 */
export async function getGroupMembership(
  ctx: Pick<QueryCtx, "auth" | "db">,
): Promise<GroupMembership | null> {
  const userId = await requireAuthenticatedUserId(ctx);
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (membership === null) return null;

  return { groupId: membership.groupId, userId, role: membership.role };
}

/**
 * 認証済みユーザーのグループメンバーシップを取得する。
 * グループ未所属の場合は ConvexError を throw する。
 */
export async function requireGroupMembership(
  ctx: Pick<QueryCtx, "auth" | "db">,
): Promise<GroupMembership> {
  const membership = await getGroupMembership(ctx);
  if (membership === null) {
    throw new ConvexError("グループに所属していません");
  }
  return membership;
}

// ---------------------------------------------------------------------------
// getMyGroup: 自分のグループ情報を取得
// ---------------------------------------------------------------------------

export async function getMyGroupHandler(ctx: QueryCtx) {
  const membership = await getGroupMembership(ctx);
  if (membership === null) return null;

  const group = await ctx.db.get(membership.groupId);
  if (group === null) return null;

  return {
    _id: group._id,
    name: group.name,
    role: membership.role,
    createdAt: group.createdAt,
  };
}

export const getMyGroup = query({
  args: {},
  handler: getMyGroupHandler,
});

// ---------------------------------------------------------------------------
// createGroup: グループを新規作成してオーナーになる
// ---------------------------------------------------------------------------

export async function createGroupHandler(ctx: MutationCtx, args: { name: string }) {
  const userId = await requireAuthenticatedUserId(ctx);

  // すでにグループに所属していないかチェック
  const existing = await ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (existing !== null) {
    throw new ConvexError("すでにグループに所属しています");
  }

  const now = Date.now();
  const groupId = await ctx.db.insert("groups", {
    name: args.name,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("groupMembers", {
    groupId,
    userId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });

  return groupId;
}

export const createGroup = mutation({
  args: { name: v.string() },
  handler: createGroupHandler,
});

// ---------------------------------------------------------------------------
// getGroupMembers: グループメンバー一覧を取得
// ---------------------------------------------------------------------------

export async function getGroupMembersHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);

  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
    .collect();

  const membersWithInfo = await Promise.all(
    members.map(async (m) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token_identifier", (q) => q.eq("userId", m.userId))
        .unique();
      return {
        userId: m.userId,
        role: m.role,
        displayName: user?.displayName ?? "ユーザー",
        email: user?.email ?? null,
        createdAt: m.createdAt,
      };
    }),
  );

  return membersWithInfo;
}

export const getGroupMembers = query({
  args: {},
  handler: getGroupMembersHandler,
});

// ---------------------------------------------------------------------------
// addMemberByEmail: Clerk で招待済み・ログイン済みのユーザーをグループへ追加
// ---------------------------------------------------------------------------

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return normalized;
}

export async function addMemberByEmailHandler(ctx: MutationCtx, args: { email: string }) {
  const { groupId, role } = await requireGroupMembership(ctx);

  if (role !== "owner") {
    throw new ConvexError("グループオーナーのみメンバーを追加できます");
  }

  const email = normalizeEmail(args.email);
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (user === null) {
    throw new ConvexError("Clerkで招待済みのユーザーがログインした後に追加できます");
  }

  const existing = await ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", user.userId))
    .unique();

  if (existing !== null) {
    if (existing.groupId === groupId) {
      throw new ConvexError("このユーザーはすでにグループに参加しています");
    }
    throw new ConvexError("このユーザーは別のグループに参加済みです");
  }

  const now = Date.now();
  await ctx.db.insert("groupMembers", {
    groupId,
    userId: user.userId,
    role: "member",
    createdAt: now,
    updatedAt: now,
  });
}

export const addMemberByEmail = mutation({
  args: { email: v.string() },
  handler: addMemberByEmailHandler,
});

// ---------------------------------------------------------------------------
// E2E cleanup: 指定ユーザーのグループ所属を削除
// ---------------------------------------------------------------------------

export const deleteGroupMembershipsByUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    return { deletedCount: memberships.length };
  },
});

// ---------------------------------------------------------------------------
// removeMember: メンバーをグループから除外（オーナーのみ）
// ---------------------------------------------------------------------------

export async function removeMemberHandler(ctx: MutationCtx, args: { targetUserId: string }) {
  const { groupId, userId, role } = await requireGroupMembership(ctx);

  if (role !== "owner") {
    throw new ConvexError("グループオーナーのみメンバーを削除できます");
  }

  if (userId === args.targetUserId) {
    throw new ConvexError("自分自身をグループから削除することはできません");
  }

  const targetMembership = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id_and_user_id", (q) =>
      q.eq("groupId", groupId).eq("userId", args.targetUserId),
    )
    .unique();

  if (targetMembership === null) {
    throw new ConvexError("指定されたメンバーが見つかりません");
  }

  await ctx.db.delete(targetMembership._id);
}

export const removeMember = mutation({
  args: { targetUserId: v.string() },
  handler: removeMemberHandler,
});

// ---------------------------------------------------------------------------
// E2E テスト用 internal mutation
// ---------------------------------------------------------------------------

export const deleteGroupForE2e = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // groupMembers を削除
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(groupId);
  },
});

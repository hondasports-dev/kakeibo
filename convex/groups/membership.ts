import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assertGroupOwnerRole } from "./adminGuards";
import { isGroupDeleted } from "./lib/groupLifecycle";
import type { GroupDoc, GroupMembership, UserDoc } from "./lib/groupTypes";
import { readQueryDoc, readQueryDocs } from "./lib/groupQueryHelpers";
import { requireAuthenticatedUserId } from "../users/auth";
import { resolveActiveMembership } from "../../lib/domain/groups/membershipResolution";

export type { GroupMembership } from "./lib/groupTypes";

export { MAX_GROUP_NAME_LENGTH, normalizeGroupName } from "./lib/groupName";

/**
 * 認証済みユーザーのグループメンバーシップ一覧を取得する。
 * データファイルから共通利用するため export する。
 */
export async function getGroupMembership(
  ctx: Pick<QueryCtx, "auth" | "db">,
): Promise<GroupMembership | null> {
  const userId = await requireAuthenticatedUserId(ctx);
  const membershipQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId));
  const memberships = await readQueryDocs(membershipQuery);

  if (memberships.length === 0) return null;

  const activeMemberships: typeof memberships = [];
  for (const membership of memberships) {
    const group = (await ctx.db.get(membership.groupId)) as GroupDoc | null;
    if (group !== null && isGroupDeleted(group)) {
      continue;
    }
    activeMemberships.push(membership);
  }

  if (activeMemberships.length === 0) return null;

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );

  const activeMembership = resolveActiveMembership(activeMemberships, user?.activeGroupId);

  if (activeMembership === null) return null;

  return {
    membershipId: activeMembership._id,
    groupId: activeMembership.groupId,
    userId,
    role: activeMembership.role,
  };
}

async function getAllGroupMemberships(ctx: Pick<QueryCtx, "auth" | "db">) {
  const userId = await requireAuthenticatedUserId(ctx);
  const membershipQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId));
  return await readQueryDocs(membershipQuery);
}

async function getCurrentUserDoc(ctx: Pick<QueryCtx, "auth" | "db">): Promise<UserDoc | null> {
  const userId = await requireAuthenticatedUserId(ctx);
  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  return user as UserDoc | null;
}

export async function getResolvedMemberships(ctx: Pick<QueryCtx, "auth" | "db">) {
  const memberships = await getAllGroupMemberships(ctx);
  const user = await getCurrentUserDoc(ctx);
  const activeGroupId = user?.activeGroupId ?? null;

  const activeMemberships: typeof memberships = [];
  for (const membership of memberships) {
    const group = (await ctx.db.get(membership.groupId)) as GroupDoc | null;
    if (group === null || isGroupDeleted(group)) {
      continue;
    }
    activeMemberships.push(membership);
  }

  const activeMembership = resolveActiveMembership(activeMemberships, activeGroupId);

  return { memberships: activeMemberships, activeMembership };
}

export async function findNextActiveGroupIdForUser(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
  excludedGroupId: Id<"groups">,
): Promise<Id<"groups"> | undefined> {
  const memberships = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );

  for (const membership of memberships) {
    if (membership.groupId === excludedGroupId) {
      continue;
    }
    const group = (await ctx.db.get(membership.groupId)) as GroupDoc | null;
    if (group !== null && !isGroupDeleted(group)) {
      return membership.groupId;
    }
  }

  return undefined;
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

/**
 * active group のオーナー権限を要求する。
 * 管理系 mutation はこのヘルパーまたは groupAdminGuards の assertion を使う。
 */
export async function requireGroupOwner(
  ctx: Pick<QueryCtx, "auth" | "db">,
): Promise<GroupMembership> {
  const membership = await requireGroupMembership(ctx);
  assertGroupOwnerRole(membership.role);
  return membership;
}

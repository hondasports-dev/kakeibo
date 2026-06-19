import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUserId } from "./users";
import {
  assertActiveGroupScope,
  assertGroupOwnerRole,
  assertNotSelfOperator,
  assertRemovableGroupMemberRole,
} from "./groupAdminGuards";
import { normalizeGroupName } from "./lib/groupName";

// 後方互換のため re-export（UI は convex/lib/groupName を直接 import すること）
export { MAX_GROUP_NAME_LENGTH, normalizeGroupName } from "./lib/groupName";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type GroupMembership = {
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
};

type GroupDoc = {
  _id: Id<"groups">;
  name: string;
  clerkOrganizationId?: string;
  createdAt: number;
  updatedAt: number;
};

type UserDoc = {
  _id: Id<"users">;
  activeGroupId?: Id<"groups">;
};

async function readQueryDocs<T>(query: {
  collect?: () => Promise<T[]>;
  take?: (count: number) => Promise<T[]>;
  unique?: () => Promise<T | null>;
}) {
  if (typeof query.collect === "function") {
    return await query.collect();
  }
  if (typeof query.take === "function") {
    return await query.take(100);
  }
  if (typeof query.unique === "function") {
    const doc = await query.unique();
    return doc === null ? [] : [doc];
  }
  return [];
}

async function readQueryDoc<T>(query: {
  unique?: () => Promise<T | null>;
  collect?: () => Promise<T[]>;
  take?: (count: number) => Promise<T[]>;
}) {
  if (typeof query.unique === "function") {
    return await query.unique();
  }
  const docs = await readQueryDocs(query);
  return docs[0] ?? null;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー: グループメンバーシップ取得
// ---------------------------------------------------------------------------

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

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );

  const activeGroupId = user?.activeGroupId ?? null;
  const activeMembership =
    activeGroupId === null
      ? memberships.length === 1
        ? memberships[0]
        : null
      : (memberships.find((membership) => membership.groupId === activeGroupId) ?? null);

  if (activeMembership === null) return null;

  return { groupId: activeMembership.groupId, userId, role: activeMembership.role };
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

async function getResolvedMemberships(ctx: Pick<QueryCtx, "auth" | "db">) {
  const memberships = await getAllGroupMemberships(ctx);
  const user = await getCurrentUserDoc(ctx);
  const activeGroupId = user?.activeGroupId ?? null;
  const activeMembership =
    activeGroupId === null
      ? memberships.length === 1
        ? memberships[0]
        : null
      : (memberships.find((membership) => membership.groupId === activeGroupId) ?? null);

  return { memberships, activeMembership };
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
    clerkOrganizationId: group.clerkOrganizationId ?? null,
    role: membership.role,
    createdAt: group.createdAt,
  };
}

export async function listMyGroupsHandler(ctx: QueryCtx) {
  const { memberships, activeMembership } = await getResolvedMemberships(ctx);
  if (memberships.length === 0) return [];

  const groups = await Promise.all(
    memberships.map(async (membership) => {
      const group = (await ctx.db.get(membership.groupId)) as GroupDoc | null;
      if (group === null) return null;
      return {
        _id: group._id,
        name: group.name,
        clerkOrganizationId: group.clerkOrganizationId ?? null,
        role: membership.role,
        createdAt: group.createdAt,
        isActive: activeMembership?.groupId === group._id,
      };
    }),
  );

  return groups.filter((group): group is NonNullable<typeof group> => group !== null);
}

export const getMyGroup = query({
  args: {},
  handler: getMyGroupHandler,
});

export const listMyGroups = query({
  args: {},
  handler: listMyGroupsHandler,
});

// ---------------------------------------------------------------------------
// createGroup: グループを新規作成してオーナーになる
// ---------------------------------------------------------------------------

export async function createGroupHandler(ctx: MutationCtx, args: { name: string }) {
  const userId = await requireAuthenticatedUserId(ctx);
  const name = normalizeGroupName(args.name);

  const now = Date.now();
  const groupId = await ctx.db.insert("groups", {
    name,
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

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  if (user !== null) {
    await ctx.db.patch(user._id, { activeGroupId: groupId, updatedAt: now });
  }

  return groupId;
}

export const createGroup = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: createGroupHandler,
});

// ---------------------------------------------------------------------------
// updateGroupName: グループ名を変更（オーナーのみ）
// ---------------------------------------------------------------------------

/**
 * active group の名前を更新する（オーナーのみ）。
 * @returns 更新したグループ ID
 */
export async function updateGroupNameHandler(ctx: MutationCtx, args: { name: string }) {
  const { groupId } = await requireGroupOwner(ctx);
  const name = normalizeGroupName(args.name);

  const group = await ctx.db.get(groupId);
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }

  await ctx.db.patch(groupId, {
    name,
    updatedAt: Date.now(),
  });

  return groupId;
}

export const updateGroupName = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: updateGroupNameHandler,
});

// ---------------------------------------------------------------------------
// getGroupMembers: グループメンバー一覧を取得
// ---------------------------------------------------------------------------

export const groupMemberListItemValidator = v.object({
  userId: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  isActiveGroup: v.boolean(),
  createdAt: v.number(),
});

type GroupMemberListItem = {
  userId: string;
  role: "owner" | "member";
  displayName: string;
  email: string | null;
  isActiveGroup: boolean;
  createdAt: number;
};

function getMemberSortLabel(member: GroupMemberListItem) {
  return member.displayName.trim() || member.email?.trim() || member.userId;
}

export function sortGroupMembersForDisplay(members: GroupMemberListItem[]) {
  return [...members].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "owner" ? -1 : 1;
    }

    const labelCompare = getMemberSortLabel(left).localeCompare(getMemberSortLabel(right), "ja");
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.createdAt - right.createdAt;
  });
}

export async function getGroupMembersHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);

  const memberQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_group_id", (q) => q.eq("groupId", groupId));
  const members = await readQueryDocs(memberQuery);

  const membersWithInfo = await Promise.all(
    members.map(async (m) => {
      const user = await readQueryDoc(
        ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", m.userId)),
      );
      return {
        userId: m.userId,
        role: m.role,
        displayName: user?.displayName ?? "ユーザー",
        email: user?.email ?? null,
        isActiveGroup: user?.activeGroupId === groupId,
        createdAt: m.createdAt,
      };
    }),
  );

  return sortGroupMembersForDisplay(membersWithInfo);
}

export const getGroupMembers = query({
  args: {},
  returns: v.array(groupMemberListItemValidator),
  handler: getGroupMembersHandler,
});

// ---------------------------------------------------------------------------
// listPendingGroupInvitations: active group の pending 招待一覧（owner のみ）
// ---------------------------------------------------------------------------

export const groupPendingInvitationListItemValidator = v.object({
  _id: v.id("groupInvitations"),
  email: v.string(),
  status: v.literal("pending"),
  createdAt: v.number(),
});

type GroupPendingInvitationListItem = {
  _id: Id<"groupInvitations">;
  email: string;
  status: "pending";
  createdAt: number;
};

export function sortPendingGroupInvitationsForDisplay(
  invitations: GroupPendingInvitationListItem[],
) {
  return [...invitations].sort((left, right) => {
    const createdAtCompare = right.createdAt - left.createdAt;
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }

    return left.email.localeCompare(right.email, "ja");
  });
}

export async function listPendingGroupInvitationsHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupOwner(ctx);

  const invitationQuery = ctx.db
    .query("groupInvitations")
    .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", "pending"));
  const invitations = await readQueryDocs(invitationQuery);

  return dedupePendingGroupInvitationsByEmail(
    invitations.map((invitation) => ({
      _id: invitation._id,
      email: invitation.email,
      status: "pending" as const,
      createdAt: invitation.createdAt,
    })),
  );
}

export const listPendingGroupInvitations = query({
  args: {},
  returns: v.array(groupPendingInvitationListItemValidator),
  handler: listPendingGroupInvitationsHandler,
});

// ---------------------------------------------------------------------------
// cancelPendingGroupInvitation: pending 招待を取り消す（owner のみ）
// ---------------------------------------------------------------------------

export async function revokePendingGroupInvitationsForEmailInGroup(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  email: string,
): Promise<string[]> {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const clerkInvitationIds: string[] = [];

  const pendingInvitations = await readQueryDocs(
    ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", "pending")),
  );

  for (const invitation of pendingInvitations) {
    if (!invitationEmailsMatch(normalizedEmail, invitation.email)) {
      continue;
    }

    await ctx.db.patch(invitation._id, { status: "revoked", updatedAt: now });
    if (invitation.clerkInvitationId) {
      clerkInvitationIds.push(invitation.clerkInvitationId);
    }
  }

  return clerkInvitationIds;
}

export async function cancelPendingGroupInvitationHandler(
  ctx: MutationCtx,
  args: { invitationId: Id<"groupInvitations"> },
) {
  const { groupId } = await requireGroupOwner(ctx);
  const invitation = await ctx.db.get(args.invitationId);

  if (invitation === null) {
    throw new ConvexError("招待が見つかりません");
  }

  assertActiveGroupScope(groupId, invitation.groupId);

  if (invitation.status !== "pending") {
    throw new ConvexError("この招待は取り消せません");
  }

  const clerkInvitationIds = await revokePendingGroupInvitationsForEmailInGroup(
    ctx,
    groupId,
    invitation.email,
  );

  return { clerkInvitationIds };
}

export const cancelPendingGroupInvitation = mutation({
  args: { invitationId: v.id("groupInvitations") },
  returns: v.object({ clerkInvitationIds: v.array(v.string()) }),
  handler: cancelPendingGroupInvitationHandler,
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

function normalizeGmailAddress(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return null;
  }

  const normalizedDomain = domain === "googlemail.com" ? "gmail.com" : domain;
  if (normalizedDomain !== "gmail.com") {
    return null;
  }

  const canonicalLocalPart = localPart.split("+")[0].replaceAll(".", "");
  return `${canonicalLocalPart}@${normalizedDomain}`;
}

export function getInvitationEmailKey(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalizeGmailAddress(normalized) ?? normalized;
}

/** 同一メール（Gmail alias 含む）の pending は最新 1 件だけを表示する */
export function dedupePendingGroupInvitationsByEmail(
  invitations: GroupPendingInvitationListItem[],
) {
  const sorted = sortPendingGroupInvitationsForDisplay(invitations);
  const latestByEmail = new Map<string, GroupPendingInvitationListItem>();

  for (const invitation of sorted) {
    const key = getInvitationEmailKey(invitation.email);
    if (!latestByEmail.has(key)) {
      latestByEmail.set(key, invitation);
    }
  }

  return sortPendingGroupInvitationsForDisplay([...latestByEmail.values()]);
}

export function invitationEmailsMatch(identityEmail: string | undefined, invitationEmail: string) {
  const normalizedIdentityEmail = identityEmail?.trim().toLowerCase();
  const normalizedInvitationEmail = invitationEmail.trim().toLowerCase();
  if (!normalizedIdentityEmail) {
    return false;
  }
  if (normalizedIdentityEmail === normalizedInvitationEmail) {
    return true;
  }

  const canonicalIdentityEmail = normalizeGmailAddress(normalizedIdentityEmail);
  const canonicalInvitationEmail = normalizeGmailAddress(normalizedInvitationEmail);
  return canonicalIdentityEmail !== null && canonicalIdentityEmail === canonicalInvitationEmail;
}

export function invitationEmailsMatchAny(
  candidateEmails: Array<string | undefined>,
  invitationEmail: string,
) {
  return candidateEmails.some((email) => invitationEmailsMatch(email, invitationEmail));
}

async function collectStaleGroupInvitationIdsForEmail(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);
  const invitationIds = new Set<Id<"groupInvitations">>();

  const considerInvitation = async (invitation: {
    _id: Id<"groupInvitations">;
    status: "pending" | "accepted" | "revoked" | "expired";
    email: string;
    acceptedByUserId?: string;
  }) => {
    if (!invitationEmailsMatch(normalizedEmail, invitation.email)) {
      return;
    }
    if (invitation.status === "pending") {
      invitationIds.add(invitation._id);
      return;
    }
    if (invitation.status !== "accepted") {
      return;
    }
    if (!invitation.acceptedByUserId) {
      invitationIds.add(invitation._id);
      return;
    }

    const membership = await readQueryDoc(
      ctx.db
        .query("groupMembers")
        .withIndex("by_group_id_and_user_id", (q) =>
          q.eq("groupId", groupId).eq("userId", invitation.acceptedByUserId!),
        ),
    );
    if (membership === null) {
      invitationIds.add(invitation._id);
    }
  };

  const exactInvitations = await readQueryDocs(
    ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id_and_email", (q) =>
        q.eq("groupId", groupId).eq("email", normalizedEmail),
      ),
  );
  for (const invitation of exactInvitations) {
    await considerInvitation(invitation);
  }

  for (const status of ["pending", "accepted"] as const) {
    const invitations = await readQueryDocs(
      ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", status)),
    );
    for (const invitation of invitations) {
      await considerInvitation(invitation);
    }
  }

  return invitationIds;
}

/** 再招待・再送前に、同一メールの古い pending と所属外の accepted を無効化する */
async function revokeGroupInvitationsForEmailInGroup(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  email: string,
) {
  const now = Date.now();
  const invitationIds = await collectStaleGroupInvitationIdsForEmail(ctx, groupId, email);

  for (const invitationId of invitationIds) {
    await ctx.db.patch(invitationId, { status: "revoked", updatedAt: now });
  }
}

export async function addMemberByEmailHandler(ctx: MutationCtx, args: { email: string }) {
  const { groupId } = await requireGroupOwner(ctx);

  const email = normalizeEmail(args.email);
  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)),
  );

  if (user === null) {
    throw new ConvexError("Clerkで招待済みのユーザーがログインした後に追加できます");
  }

  const existingMembershipInGroup = await readQueryDoc(
    ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", groupId).eq("userId", user.userId),
      ),
  );

  if (existingMembershipInGroup !== null) {
    throw new ConvexError("このユーザーはすでにグループに参加しています");
  }

  const now = Date.now();
  await ctx.db.insert("groupMembers", {
    groupId,
    userId: user.userId,
    role: "member",
    createdAt: now,
    updatedAt: now,
  });

  if (!user.activeGroupId) {
    await ctx.db.patch(user._id, { activeGroupId: groupId, updatedAt: now });
  }
}

export const addMemberByEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: addMemberByEmailHandler,
});

export async function setActiveGroupHandler(ctx: MutationCtx, args: { groupId: Id<"groups"> }) {
  const userId = await requireAuthenticatedUserId(ctx);
  const membership = await readQueryDoc(
    ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      ),
  );

  if (membership === null) {
    throw new ConvexError("指定されたグループに所属していません");
  }

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  if (user === null) {
    throw new ConvexError("User not found");
  }

  await ctx.db.patch(user._id, {
    activeGroupId: args.groupId,
    updatedAt: Date.now(),
  });

  return args.groupId;
}

export const setActiveGroup = mutation({
  args: { groupId: v.id("groups") },
  returns: v.id("groups"),
  handler: setActiveGroupHandler,
});

// ---------------------------------------------------------------------------
// E2E cleanup: 指定ユーザーのグループ所属を削除
// ---------------------------------------------------------------------------

export const deleteGroupMembershipsByUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const membershipQuery = ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", userId));
    const memberships = await readQueryDocs(membershipQuery);

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    const user = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
    );
    if (user !== null) {
      await ctx.db.patch(user._id, { activeGroupId: undefined, updatedAt: Date.now() });
    }

    return { deletedCount: memberships.length };
  },
});

export const setGroupMemberRoleForE2e = internalMutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, { userId, role }) => {
    const user = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
    );
    const memberships = await readQueryDocs(
      ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", userId)),
    );

    if (memberships.length === 0) {
      return { updated: false };
    }

    const activeMembership =
      (user?.activeGroupId
        ? memberships.find((membership) => membership.groupId === user.activeGroupId)
        : undefined) ?? memberships[0];

    if (!activeMembership) {
      return { updated: false };
    }

    await ctx.db.patch(activeMembership._id, {
      role,
      updatedAt: Date.now(),
    });

    return { updated: true };
  },
});

export const getGroupIdByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
    );
    const membershipQuery = ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", userId));
    const memberships = await readQueryDocs(membershipQuery);

    if (memberships.length === 0) return null;
    if (user?.activeGroupId) {
      const active = memberships.find((membership) => membership.groupId === user.activeGroupId);
      if (active) return active.groupId;
    }
    return memberships[0]?.groupId ?? null;
  },
});

/** 所属チェックと承認済み（まだ所属中）チェック。pending の無効化は呼び出し前に revoke すること。 */
export async function assertEmailCanBeInvitedToGroupHandler(
  ctx: Pick<QueryCtx, "db">,
  args: { groupId: Id<"groups">; email: string },
) {
  const email = normalizeEmail(args.email);
  const members = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_group_id", (q) => q.eq("groupId", args.groupId)),
  );

  for (const member of members) {
    const user = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", member.userId)),
    );
    if (user?.email && invitationEmailsMatch(user.email, email)) {
      throw new ConvexError("このユーザーはすでにグループに参加しています");
    }
  }

  const acceptedInvitations = await readQueryDocs(
    ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id_and_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "accepted"),
      ),
  );
  for (const invitation of acceptedInvitations) {
    if (!invitationEmailsMatch(invitation.email, email) || !invitation.acceptedByUserId) {
      continue;
    }

    const membership = await readQueryDoc(
      ctx.db
        .query("groupMembers")
        .withIndex("by_group_id_and_user_id", (q) =>
          q.eq("groupId", args.groupId).eq("userId", invitation.acceptedByUserId!),
        ),
    );
    if (membership !== null) {
      throw new ConvexError("このメールアドレスの招待はすでに承認済みです");
    }
  }

  return null;
}

export const assertEmailCanBeInvitedToGroup = internalQuery({
  args: { groupId: v.id("groups"), email: v.string() },
  handler: assertEmailCanBeInvitedToGroupHandler,
});

export async function createGroupInvitationRecordHandler(
  ctx: MutationCtx,
  args: {
    groupId: Id<"groups">;
    email: string;
    token: string;
    invitedByUserId: string;
    clerkInvitationId?: string;
  },
) {
  const now = Date.now();
  const existing = await readQueryDoc(
    ctx.db.query("groupInvitations").withIndex("by_token", (q) => q.eq("token", args.token)),
  );

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "pending",
      updatedAt: now,
      ...(args.clerkInvitationId ? { clerkInvitationId: args.clerkInvitationId } : {}),
    });
    return existing._id;
  }

  await revokeGroupInvitationsForEmailInGroup(ctx, args.groupId, args.email);
  await assertEmailCanBeInvitedToGroupHandler(ctx, {
    groupId: args.groupId,
    email: args.email,
  });

  const invitation = {
    groupId: args.groupId,
    email: normalizeEmail(args.email),
    token: args.token,
    status: "pending" as const,
    invitedByUserId: args.invitedByUserId,
    createdAt: now,
    updatedAt: now,
    ...(args.clerkInvitationId ? { clerkInvitationId: args.clerkInvitationId } : {}),
  };

  return await ctx.db.insert("groupInvitations", invitation);
}

export const createGroupInvitationRecord = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    token: v.string(),
    invitedByUserId: v.string(),
    clerkInvitationId: v.optional(v.string()),
  },
  handler: createGroupInvitationRecordHandler,
});

export async function deletePendingGroupInvitationRecordByTokenHandler(
  ctx: MutationCtx,
  args: { token: string },
) {
  const existing = await readQueryDoc(
    ctx.db.query("groupInvitations").withIndex("by_token", (q) => q.eq("token", args.token)),
  );

  if (existing === null || existing.status !== "pending" || existing.clerkInvitationId) {
    return null;
  }

  await ctx.db.delete(existing._id);
  return existing._id;
}

export const deletePendingGroupInvitationRecordByToken = internalMutation({
  args: { token: v.string() },
  handler: deletePendingGroupInvitationRecordByTokenHandler,
});

export const setGroupClerkOrganizationId = internalMutation({
  args: { groupId: v.id("groups"), clerkOrganizationId: v.string() },
  handler: async (ctx, { groupId, clerkOrganizationId }) => {
    const group = await ctx.db.get(groupId);
    if (group === null) {
      throw new ConvexError("Group not found");
    }

    await ctx.db.patch(groupId, {
      clerkOrganizationId,
      updatedAt: Date.now(),
    });
  },
});

export async function acceptGroupInvitationForVerifiedEmailsHandler(
  ctx: MutationCtx,
  args: { token: string; acceptedUserId: string; acceptedEmails: string[] },
) {
  const invite = await readQueryDoc(
    ctx.db.query("groupInvitations").withIndex("by_token", (q) => q.eq("token", args.token)),
  );

  if (invite === null || invite.status !== "pending") {
    throw new ConvexError("招待が見つかりません");
  }

  if (!invitationEmailsMatchAny(args.acceptedEmails, invite.email)) {
    throw new ConvexError("招待先メールアドレスと一致しません");
  }

  const existingMembershipQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_group_id_and_user_id", (q) =>
      q.eq("groupId", invite.groupId).eq("userId", args.acceptedUserId),
    );
  const existingMembership = await readQueryDoc(existingMembershipQuery);

  const now = Date.now();
  if (existingMembership === null) {
    await ctx.db.insert("groupMembers", {
      groupId: invite.groupId,
      userId: args.acceptedUserId,
      role: "member",
      createdAt: now,
      updatedAt: now,
    });
  }

  const user = await readQueryDoc(
    ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.acceptedUserId)),
  );
  if (user !== null) {
    await ctx.db.patch(user._id, { activeGroupId: invite.groupId, updatedAt: now });
  }

  await ctx.db.patch(invite._id, {
    status: "accepted",
    acceptedByUserId: args.acceptedUserId,
    acceptedAt: now,
    updatedAt: now,
  });

  await revokeGroupInvitationsForEmailInGroup(ctx, invite.groupId, invite.email);

  return invite.groupId;
}

export async function acceptGroupInvitationHandler(ctx: MutationCtx, args: { token: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Not authenticated");
  }

  return await acceptGroupInvitationForVerifiedEmailsHandler(ctx, {
    token: args.token,
    acceptedUserId: identity.tokenIdentifier,
    acceptedEmails: [identity.email ?? ""],
  });
}

export const acceptGroupInvitation = mutation({
  args: { token: v.string() },
  returns: v.id("groups"),
  handler: acceptGroupInvitationHandler,
});

export const acceptGroupInvitationForVerifiedEmails = internalMutation({
  args: {
    token: v.string(),
    acceptedUserId: v.string(),
    acceptedEmails: v.array(v.string()),
  },
  handler: acceptGroupInvitationForVerifiedEmailsHandler,
});

// ---------------------------------------------------------------------------
// removeMember: メンバーをグループから除外（オーナーのみ）
// ---------------------------------------------------------------------------

export async function removeMemberHandler(ctx: MutationCtx, args: { targetUserId: string }) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  assertNotSelfOperator(userId, args.targetUserId);

  const targetMembership = await readQueryDoc(
    ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", groupId).eq("userId", args.targetUserId),
      ),
  );

  if (targetMembership === null) {
    throw new ConvexError("指定されたメンバーが見つかりません");
  }

  assertRemovableGroupMemberRole(targetMembership.role);

  await ctx.db.delete(targetMembership._id);

  const remainingMemberships = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId)),
  );
  const targetUser = await readQueryDoc(
    ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.targetUserId)),
  );
  if (targetUser !== null) {
    const nextActiveGroupId = remainingMemberships[0]?.groupId ?? undefined;
    await ctx.db.patch(targetUser._id, {
      activeGroupId: nextActiveGroupId,
      updatedAt: Date.now(),
    });
    if (targetUser.email) {
      await revokeGroupInvitationsForEmailInGroup(ctx, groupId, targetUser.email);
    }
  }
}

export const removeMember = mutation({
  args: { targetUserId: v.string() },
  returns: v.null(),
  handler: removeMemberHandler,
});

// ---------------------------------------------------------------------------
// E2E テスト用 internal mutation
// ---------------------------------------------------------------------------

export const deleteGroupForE2e = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // groupMembers を削除
    const memberQuery = ctx.db
      .query("groupMembers")
      .withIndex("by_group_id", (q) => q.eq("groupId", groupId));
    const members = await readQueryDocs(memberQuery);
    for (const m of members) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(groupId);
  },
});

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUserId } from "./users";
import {
  assertGroupOwnerRole,
  assertNotSelfOperator,
  assertRemovableGroupMemberRole,
} from "./groupAdminGuards";

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
  handler: createGroupHandler,
});

// ---------------------------------------------------------------------------
// getGroupMembers: グループメンバー一覧を取得
// ---------------------------------------------------------------------------

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

  const exactInvitations = await readQueryDocs(
    ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id_and_email", (q) => q.eq("groupId", args.groupId).eq("email", email)),
  );
  const matchingExactInvitation = exactInvitations.find(
    (invitation) => invitation.status === "pending" || invitation.status === "accepted",
  );
  if (matchingExactInvitation?.status === "pending") {
    throw new ConvexError("このメールアドレスにはすでに招待を送信しています");
  }
  if (matchingExactInvitation?.status === "accepted") {
    throw new ConvexError("このメールアドレスの招待はすでに承認済みです");
  }

  for (const status of ["pending", "accepted"] as const) {
    const invitations = await readQueryDocs(
      ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id_and_status", (q) =>
          q.eq("groupId", args.groupId).eq("status", status),
        ),
    );
    const matchingInvitation = invitations.find((invitation) =>
      invitationEmailsMatch(invitation.email, email),
    );
    if (matchingInvitation && status === "pending") {
      throw new ConvexError("このメールアドレスにはすでに招待を送信しています");
    }
    if (matchingInvitation && status === "accepted") {
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
  }
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

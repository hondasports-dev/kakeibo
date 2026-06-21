import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assertActiveGroupScope } from "./adminGuards";
import {
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  normalizeEmail,
} from "./lib/groupEmailMatching";
import { readQueryDoc, readQueryDocs } from "./lib/groupQueryHelpers";
import { recordManagementAuditLog } from "./lib/managementAuditLog";
import { requireGroupOwner } from "./membership";
import { setGroupClerkOrganizationIdHandler } from "./e2e";

export {
  dedupePendingGroupInvitationsByEmail,
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  sortPendingGroupInvitationsForDisplay,
} from "./lib/groupEmailMatching";

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
  const { groupId, userId } = await requireGroupOwner(ctx);
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

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "invitation_revoked",
    targetKind: "invitation",
    targetId: invitation._id,
    targetLabel: invitation.email,
  });

  return { clerkInvitationIds };
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
export async function revokeGroupInvitationsForEmailInGroup(
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

export const cancelPendingGroupInvitation = mutation({
  args: { invitationId: v.id("groupInvitations") },
  returns: v.object({ clerkInvitationIds: v.array(v.string()) }),
  handler: cancelPendingGroupInvitationHandler,
});

export const assertEmailCanBeInvitedToGroup = internalQuery({
  args: { groupId: v.id("groups"), email: v.string() },
  handler: assertEmailCanBeInvitedToGroupHandler,
});

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

export const deletePendingGroupInvitationRecordByToken = internalMutation({
  args: { token: v.string() },
  handler: deletePendingGroupInvitationRecordByTokenHandler,
});

export const setGroupClerkOrganizationId = internalMutation({
  args: { groupId: v.id("groups"), clerkOrganizationId: v.string() },
  handler: setGroupClerkOrganizationIdHandler,
});

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

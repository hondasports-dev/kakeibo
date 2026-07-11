import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import {
  assertGroupHasMinimumOwners,
  assertNotSelfOperator,
  assertRemovableGroupMemberRole,
  GROUP_ADMIN_ERRORS,
  type GroupAdminRole,
} from "./adminGuards";
import { normalizeEmail } from "./lib/groupEmailMatching";
import { readQueryDoc, readQueryDocs } from "./lib/groupQueryHelpers";
import { formatGroupRoleLabel } from "./lib/groupRoleLabel";
import { recordManagementAuditLog } from "./lib/managementAuditLog";
import { revokeGroupInvitationsForEmailInGroup } from "./invitations";
import { requireGroupOwner } from "./membership";
import {
  enqueueGroupMembershipRemovedEmail,
  enqueueGroupOwnershipReceivedEmail,
  enqueueGroupOwnershipTransferredEmail,
  enqueueGroupRoleChangedEmail,
} from "./lib/emailNotifications";

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

export async function removeMemberHandler(ctx: MutationCtx, args: { targetUserId: string }) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  assertNotSelfOperator(userId, args.targetUserId);

  const group = await ctx.db.get(groupId);
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }

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

  const targetUser = await readQueryDoc(
    ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.targetUserId)),
  );
  const targetLabel =
    targetUser?.displayName?.trim() || targetUser?.email?.trim() || args.targetUserId;
  const groupName = group.name;

  await ctx.db.delete(targetMembership._id);

  const remainingMemberships = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId)),
  );
  const removedTargetUser = targetUser;
  if (removedTargetUser !== null) {
    const nextActiveGroupId = remainingMemberships[0]?.groupId ?? undefined;
    await ctx.db.patch(removedTargetUser._id, {
      activeGroupId: nextActiveGroupId,
      updatedAt: Date.now(),
    });
    if (removedTargetUser.email) {
      await revokeGroupInvitationsForEmailInGroup(ctx, groupId, removedTargetUser.email);
    }
  }

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "member_removed",
    targetKind: "member",
    targetId: args.targetUserId,
    targetLabel,
  });

  await enqueueGroupMembershipRemovedEmail(ctx, groupName, targetUser?.email);
}

export async function changeMemberRoleHandler(
  ctx: MutationCtx,
  args: { targetUserId: string; newRole: GroupAdminRole },
) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  assertNotSelfOperator(userId, args.targetUserId);

  const group = await ctx.db.get(groupId);
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }

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

  const currentRole = targetMembership.role;
  if (currentRole === args.newRole) {
    throw new ConvexError("すでに同じロールです");
  }

  if (currentRole === "owner" && args.newRole === "member") {
    await assertGroupHasMinimumOwners(ctx, groupId, 2);
  }

  const now = Date.now();
  await ctx.db.patch(targetMembership._id, {
    role: args.newRole,
    updatedAt: now,
  });

  const targetUser = await readQueryDoc(
    ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.targetUserId)),
  );
  const targetLabel =
    targetUser?.displayName?.trim() || targetUser?.email?.trim() || args.targetUserId;

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "member_role_changed",
    targetKind: "member",
    targetId: args.targetUserId,
    targetLabel,
    beforeValue: formatGroupRoleLabel(currentRole),
    afterValue: formatGroupRoleLabel(args.newRole),
  });

  await enqueueGroupRoleChangedEmail(
    ctx,
    group.name,
    currentRole,
    args.newRole,
    targetUser?.email,
  );
}

export async function transferGroupOwnershipHandler(
  ctx: MutationCtx,
  args: { targetUserId: string },
) {
  const { groupId, userId, membershipId: actorMembershipId } = await requireGroupOwner(ctx);
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

  if (targetMembership.role !== "member") {
    throw new ConvexError(GROUP_ADMIN_ERRORS.TRANSFER_TARGET_MUST_BE_MEMBER);
  }

  const actorUser = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  const targetUser = await readQueryDoc(
    ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.targetUserId)),
  );
  const actorLabel = actorUser?.displayName?.trim() || actorUser?.email?.trim() || userId;
  const targetLabel =
    targetUser?.displayName?.trim() || targetUser?.email?.trim() || args.targetUserId;

  const now = Date.now();
  // 最後の owner 不在を避けるため、先に譲渡先を owner に昇格してから譲渡元を member に降格する
  await ctx.db.patch(targetMembership._id, {
    role: "owner",
    updatedAt: now,
  });
  await ctx.db.patch(actorMembershipId, {
    role: "member",
    updatedAt: now,
  });

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "owner_transferred",
    targetKind: "member",
    targetId: args.targetUserId,
    targetLabel,
    beforeValue: `オーナー: ${actorLabel}`,
    afterValue: `オーナー: ${targetLabel}（${actorLabel} → ${formatGroupRoleLabel("member")}）`,
  });
}

export const addMemberByEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: addMemberByEmailHandler,
});

export const removeMember = mutation({
  args: { targetUserId: v.string() },
  returns: v.null(),
  handler: removeMemberHandler,
});

export const changeMemberRole = mutation({
  args: {
    targetUserId: v.string(),
    newRole: v.union(v.literal("owner"), v.literal("member")),
  },
  returns: v.null(),
  handler: changeMemberRoleHandler,
});

export const transferGroupOwnership = mutation({
  args: { targetUserId: v.string() },
  returns: v.null(),
  handler: transferGroupOwnershipHandler,
});

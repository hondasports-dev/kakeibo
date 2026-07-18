import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertAccountDeletionNotInProgress } from "./accountDeletion";
import { requireSystemAdmin } from "./systemAdmins";

const operationValidator = v.union(
  v.literal("add"),
  v.literal("remove"),
  v.literal("transfer"),
  v.literal("set_active"),
  v.literal("clear_active"),
);
const resultValidator = v.object({
  operation: operationValidator,
  status: v.literal("success"),
});
const reasonMaxLength = 500;
type Operation = "add" | "remove" | "transfer" | "set_active" | "clear_active";
type MembershipStatus = "none" | "member" | "owner";

function normalizeReason(reason: string) {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > reasonMaxLength) {
    throw new ConvexError("理由は1〜500文字で入力してください");
  }
  return normalized;
}

function assertGroupArgumentShape(
  operation: Operation,
  sourceGroupId: Id<"groups"> | undefined,
  targetGroupId: Id<"groups"> | undefined,
) {
  const valid =
    (operation === "add" && !sourceGroupId && !!targetGroupId) ||
    (operation === "remove" && !!sourceGroupId && !targetGroupId) ||
    (operation === "transfer" && !!sourceGroupId && !!targetGroupId) ||
    (operation === "set_active" && !sourceGroupId && !!targetGroupId) ||
    (operation === "clear_active" && !sourceGroupId && !targetGroupId);
  if (!valid) throw new ConvexError("操作対象グループの指定が不正です");
  if (sourceGroupId && targetGroupId && sourceGroupId === targetGroupId) {
    throw new ConvexError("移動元と移動先は異なるグループを指定してください");
  }
}

async function readMembership(ctx: MutationCtx, groupId: Id<"groups">, userId: string) {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id_and_user_id", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

async function requireActiveGroup(ctx: MutationCtx, groupId: Id<"groups">) {
  const group = await ctx.db.get(groupId);
  if (!group || (group.status !== undefined && group.status !== "active")) {
    throw new ConvexError("active状態のグループだけを指定できます");
  }
  return group;
}

async function insertMembershipChangeNotifications(
  ctx: MutationCtx,
  auditId: Id<"systemAdminAuditLogs">,
  targetUserId: Id<"users">,
  groupIds: Array<Id<"groups"> | undefined>,
  operation: Operation,
  sourceGroupId: Id<"groups"> | undefined,
  targetGroupId: Id<"groups"> | undefined,
) {
  const recipients = new Set<Id<"users">>([targetUserId]);
  for (const groupId of new Set(groupIds.filter((id): id is Id<"groups"> => !!id))) {
    const owners = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_role", (q) => q.eq("groupId", groupId).eq("role", "owner"))
      .take(101);
    if (owners.length > 100) {
      throw new ConvexError("1グループあたりのowner数が上限を超えています");
    }
    for (const owner of owners) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token_identifier", (q) => q.eq("userId", owner.userId))
        .unique();
      if (user) recipients.add(user._id);
    }
  }

  const payload = JSON.stringify({
    operation,
    targetUserId,
    sourceGroupId: sourceGroupId ?? null,
    targetGroupId: targetGroupId ?? null,
    environment: process.env.APP_ENV ?? "development",
  });
  for (const recipientUserId of recipients) {
    const dedupeKey = `${auditId}:${recipientUserId}`;
    const existing = await ctx.db
      .query("systemAdminNotifications")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
      .unique();
    if (existing) continue;
    await ctx.db.insert("systemAdminNotifications", {
      action: "system_admin_membership_changed",
      recipientUserId,
      targetUserId,
      dedupeKey,
      payloadJson: payload,
      createdAt: Date.now(),
    });
  }
}

async function insertMembershipAudit(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<"users">;
    targetUserId: Id<"users">;
    targetDisplayNameSnapshot: string;
    action: Doc<"systemAdminAuditLogs">["action"];
    sourceGroupId?: Id<"groups">;
    sourceGroupNameSnapshot?: string;
    targetGroupId?: Id<"groups">;
    targetGroupNameSnapshot?: string;
    beforeMembershipStatus: MembershipStatus;
    afterMembershipStatus: MembershipStatus;
    beforeActiveGroupId?: Id<"groups">;
    afterActiveGroupId?: Id<"groups">;
    reason: string;
  },
) {
  return await ctx.db.insert("systemAdminAuditLogs", {
    action: args.action,
    actorType: "system_admin",
    actorUserId: args.actorUserId,
    targetKind: "user",
    targetUserId: args.targetUserId,
    targetDisplayNameSnapshot: args.targetDisplayNameSnapshot,
    reason: args.reason,
    sourceGroupId: args.sourceGroupId,
    sourceGroupNameSnapshot: args.sourceGroupNameSnapshot,
    targetGroupId: args.targetGroupId,
    targetGroupNameSnapshot: args.targetGroupNameSnapshot,
    beforeMembershipStatus: args.beforeMembershipStatus,
    afterMembershipStatus: args.afterMembershipStatus,
    beforeActiveGroupId: args.beforeActiveGroupId,
    afterActiveGroupId: args.afterActiveGroupId,
    result: "success",
    createdAt: Date.now(),
  });
}

export const systemAdminMembershipOperation = mutation({
  args: {
    targetUserId: v.id("users"),
    operation: operationValidator,
    sourceGroupId: v.optional(v.id("groups")),
    targetGroupId: v.optional(v.id("groups")),
    reason: v.string(),
  },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const { user: actor } = await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    assertGroupArgumentShape(args.operation, args.sourceGroupId, args.targetGroupId);

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) throw new ConvexError("対象ユーザーが見つかりません");
    await assertAccountDeletionNotInProgress(ctx, targetUser.userId);

    const sourceGroup = args.sourceGroupId
      ? await requireActiveGroup(ctx, args.sourceGroupId)
      : undefined;
    const targetGroup = args.targetGroupId
      ? await requireActiveGroup(ctx, args.targetGroupId)
      : undefined;
    const sourceMembership = sourceGroup
      ? await readMembership(ctx, sourceGroup._id, targetUser.userId)
      : null;
    const targetMembership = targetGroup
      ? await readMembership(ctx, targetGroup._id, targetUser.userId)
      : null;
    const clearActiveGroup =
      args.operation === "clear_active" && targetUser.activeGroupId
        ? await ctx.db.get(targetUser.activeGroupId)
        : undefined;
    const clearActiveMembership =
      args.operation === "clear_active" && targetUser.activeGroupId
        ? await readMembership(ctx, targetUser.activeGroupId, targetUser.userId)
        : null;
    const currentActiveMembership =
      targetUser.activeGroupId && args.operation !== "clear_active"
        ? await readMembership(ctx, targetUser.activeGroupId, targetUser.userId)
        : null;
    if (
      targetUser.activeGroupId &&
      args.operation !== "clear_active" &&
      args.operation !== "set_active" &&
      !currentActiveMembership
    ) {
      throw new ConvexError("activeグループの所属が見つからないため操作できません");
    }
    const beforeActiveGroupId = targetUser.activeGroupId;
    let afterActiveGroupId = beforeActiveGroupId;
    let beforeMembershipStatus: MembershipStatus = "none";
    let afterMembershipStatus: MembershipStatus = "none";
    let action: Doc<"systemAdminAuditLogs">["action"];
    let notificationGroupIds: Array<Id<"groups"> | undefined> = [];

    switch (args.operation) {
      case "add":
        if (targetMembership) throw new ConvexError("このユーザーはすでにグループに所属しています");
        await ctx.db.insert("groupMembers", {
          groupId: targetGroup!._id,
          userId: targetUser.userId,
          role: "member",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        beforeMembershipStatus = "none";
        afterMembershipStatus = "member";
        action = "system_admin_membership_added";
        notificationGroupIds = [targetGroup!._id];
        break;
      case "remove":
        if (!sourceMembership) throw new ConvexError("指定されたメンバーが見つかりません");
        if (sourceMembership.role === "owner") {
          throw new ConvexError("ownerの所属解除はこの操作ではできません");
        }
        await ctx.db.delete(sourceMembership._id);
        if (targetUser.activeGroupId === sourceGroup!._id) afterActiveGroupId = undefined;
        beforeMembershipStatus = "member";
        afterMembershipStatus = "none";
        action = "system_admin_membership_removed";
        notificationGroupIds = [sourceGroup!._id];
        break;
      case "transfer":
        if (!sourceMembership) throw new ConvexError("移動元グループの所属が見つかりません");
        if (sourceMembership.role === "owner") {
          throw new ConvexError("ownerの付替えはこの操作ではできません");
        }
        if (targetMembership) throw new ConvexError("移動先グループにすでに所属しています");
        await ctx.db.delete(sourceMembership._id);
        await ctx.db.insert("groupMembers", {
          groupId: targetGroup!._id,
          userId: targetUser.userId,
          role: "member",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        if (targetUser.activeGroupId === sourceGroup!._id) afterActiveGroupId = targetGroup!._id;
        beforeMembershipStatus = "member";
        afterMembershipStatus = "member";
        action = "system_admin_membership_transferred";
        notificationGroupIds = [sourceGroup!._id, targetGroup!._id];
        break;
      case "set_active":
        if (!targetMembership) throw new ConvexError("activeグループに指定する所属がありません");
        if (targetUser.activeGroupId === targetGroup!._id) {
          throw new ConvexError("すでにactiveグループに設定されています");
        }
        afterActiveGroupId = targetGroup!._id;
        beforeMembershipStatus = targetMembership.role;
        afterMembershipStatus = targetMembership.role;
        action = "system_admin_active_group_set";
        notificationGroupIds = [targetGroup!._id];
        break;
      case "clear_active":
        if (!targetUser.activeGroupId) throw new ConvexError("activeグループは未選択です");
        afterActiveGroupId = undefined;
        beforeMembershipStatus = clearActiveMembership?.role ?? "none";
        afterMembershipStatus = beforeMembershipStatus;
        action = "system_admin_active_group_cleared";
        notificationGroupIds = [targetUser.activeGroupId];
        break;
    }

    if (args.operation === "set_active" || args.operation === "clear_active") {
      await ctx.db.patch(targetUser._id, {
        activeGroupId: afterActiveGroupId,
        updatedAt: Date.now(),
      });
    } else if (afterActiveGroupId !== beforeActiveGroupId) {
      await ctx.db.patch(targetUser._id, {
        activeGroupId: afterActiveGroupId,
        updatedAt: Date.now(),
      });
    }

    const auditId = await insertMembershipAudit(ctx, {
      actorUserId: actor._id,
      targetUserId: targetUser._id,
      targetDisplayNameSnapshot:
        targetUser.displayName.trim() || targetUser.email || targetUser.userId,
      action,
      sourceGroupId: sourceGroup?._id ?? clearActiveGroup?._id,
      sourceGroupNameSnapshot: sourceGroup?.name ?? clearActiveGroup?.name,
      targetGroupId: targetGroup?._id,
      targetGroupNameSnapshot: targetGroup?.name,
      beforeMembershipStatus,
      afterMembershipStatus,
      beforeActiveGroupId,
      afterActiveGroupId,
      reason,
    });
    await insertMembershipChangeNotifications(
      ctx,
      auditId,
      targetUser._id,
      notificationGroupIds,
      args.operation,
      sourceGroup?._id ?? clearActiveGroup?._id,
      targetGroup?._id,
    );
    return { operation: args.operation, status: "success" as const };
  },
});

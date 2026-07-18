import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSystemAdmin } from "./systemAdmins";
import { assertAccountDeletionNotInProgress } from "./accountDeletion";

const operationValidator = v.union(v.literal("change_role"), v.literal("transfer_owner"));
const roleValidator = v.union(v.literal("owner"), v.literal("member"));

async function notify(
  ctx: MutationCtx,
  auditId: Id<"systemAdminAuditLogs">,
  targetUserId: Id<"users">,
  groupId: Id<"groups">,
  operation: string,
  extraRecipientUserId?: Id<"users">,
) {
  const recipients = new Set<Id<"users">>([targetUserId]);
  if (extraRecipientUserId) recipients.add(extraRecipientUserId);
  const owners = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id_and_role", (q) => q.eq("groupId", groupId).eq("role", "owner"))
    .take(101);
  if (owners.length > 100) throw new ConvexError("owner数が上限を超えています");
  for (const owner of owners) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", owner.userId))
      .unique();
    if (user) recipients.add(user._id);
  }
  const admins = await ctx.db
    .query("systemAdmins")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(101);
  if (admins.length > 100) throw new ConvexError("active system admin数が上限を超えています");
  for (const admin of admins) recipients.add(admin.userId);
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
      payloadJson: JSON.stringify({
        operation,
        groupId,
        targetUserId,
        environment: process.env.APP_ENV ?? "development",
      }),
      createdAt: Date.now(),
    });
  }
}

export const systemAdminRoleOperation = mutation({
  args: {
    operation: operationValidator,
    groupId: v.id("groups"),
    targetUserId: v.id("users"),
    sourceOwnerUserId: v.optional(v.id("users")),
    newRole: v.optional(roleValidator),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length < 1 || reason.length > 500)
      throw new ConvexError("理由は1〜500文字で入力してください");
    const group = await ctx.db.get(args.groupId);
    if (!group || group.status !== "active")
      throw new ConvexError("active状態のグループだけを指定できます");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    const targetMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", args.groupId).eq("userId", target.userId),
      )
      .unique();
    if (!targetMembership) throw new ConvexError("対象ユーザーはこのgroupのmemberではありません");
    await assertAccountDeletionNotInProgress(ctx, target.userId);
    const owners = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_role", (q) => q.eq("groupId", args.groupId).eq("role", "owner"))
      .take(101);
    if (owners.length > 100) throw new ConvexError("owner数が上限を超えています");
    let action: "system_admin_group_role_changed" | "system_admin_group_owner_transferred";
    let sourceUser: typeof target | undefined;
    let beforeRole = targetMembership.role;
    let afterRole = targetMembership.role;
    if (args.operation === "change_role") {
      if (!args.newRole || args.sourceOwnerUserId)
        throw new ConvexError("role変更の指定が不正です");
      if (args.newRole === targetMembership.role) throw new ConvexError("すでに同じroleです");
      if (args.newRole === "owner" && owners.length === 0)
        throw new ConvexError("owner不在groupは専用の復旧フローを使ってください");
      if (args.newRole === "member" && owners.length <= 1)
        throw new ConvexError("最後のownerはmemberへ変更できません");
      afterRole = args.newRole;
      action = "system_admin_group_role_changed";
    } else {
      if (args.newRole || !args.sourceOwnerUserId || args.sourceOwnerUserId === args.targetUserId)
        throw new ConvexError("owner付替えの指定が不正です");
      const source = await ctx.db.get(args.sourceOwnerUserId);
      if (!source) throw new ConvexError("付替え元ユーザーが存在しません");
      sourceUser = source;
      await assertAccountDeletionNotInProgress(ctx, source.userId);
      const sourceMembership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id_and_user_id", (q) =>
          q.eq("groupId", args.groupId).eq("userId", source.userId),
        )
        .unique();
      if (!sourceMembership || sourceMembership.role !== "owner")
        throw new ConvexError("付替え元はownerではありません");
      if (targetMembership.role !== "member")
        throw new ConvexError("付替え先はmemberである必要があります");
      afterRole = "owner";
      await ctx.db.patch(targetMembership._id, { role: "owner", updatedAt: Date.now() });
      await ctx.db.patch(sourceMembership._id, { role: "member", updatedAt: Date.now() });
      action = "system_admin_group_owner_transferred";
    }
    if (args.operation === "change_role")
      await ctx.db.patch(targetMembership._id, { role: afterRole, updatedAt: Date.now() });
    const auditId = await ctx.db.insert("systemAdminAuditLogs", {
      action,
      actorType: "system_admin",
      actorUserId: actor.user._id,
      targetKind: "group",
      targetUserId: target._id,
      targetId: args.groupId,
      targetDisplayNameSnapshot: target.displayName,
      sourceUserId: sourceUser?._id,
      sourceUserDisplayNameSnapshot: sourceUser?.displayName,
      reason,
      beforeMembershipStatus: beforeRole,
      afterMembershipStatus: afterRole,
      beforeOwnerCount: owners.length,
      afterOwnerCount:
        args.operation === "change_role" && afterRole === "member"
          ? owners.length - 1
          : args.operation === "change_role"
            ? owners.length + 1
            : owners.length,
      sourceGroupId: args.groupId,
      sourceGroupNameSnapshot: group.name,
      result: "success",
      createdAt: Date.now(),
    });
    await notify(
      ctx,
      auditId,
      target._id,
      args.groupId,
      args.operation,
      args.operation === "transfer_owner" ? args.sourceOwnerUserId : undefined,
    );
    return null;
  },
});

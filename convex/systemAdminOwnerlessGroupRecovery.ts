import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSystemAdmin } from "./systemAdmins";
import {
  getNormalizeReasonErrorMessage,
  normalizeSystemAdminReason,
} from "../lib/domain/systemAdmin/reason";

const MAX_OWNERS = 100;

async function enqueueNotifications(
  ctx: MutationCtx,
  targetUserId: Id<"users">,
  groupId: Id<"groups">,
  auditId: Id<"systemAdminAuditLogs">,
) {
  const recipients = new Set<Id<"users">>([targetUserId]);
  const admins = await ctx.db
    .query("systemAdmins")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(101);
  if (admins.length > 100) throw new ConvexError("active system admin数が上限を超えています");
  for (const admin of admins) recipients.add(admin.userId);
  const now = Date.now();
  for (const recipientUserId of recipients) {
    const dedupeKey = `${auditId}:${recipientUserId}`;
    const existing = await ctx.db
      .query("systemAdminNotifications")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
      .unique();
    if (existing) continue;
    await ctx.db.insert("systemAdminNotifications", {
      action: "system_admin_ownerless_group_recovered",
      recipientUserId,
      targetUserId,
      dedupeKey,
      payloadJson: JSON.stringify({ action: "system_admin_ownerless_group_recovered", groupId }),
      createdAt: now,
    });
  }
}

export const recoverOwnerlessGroup = mutation({
  args: {
    groupId: v.id("groups"),
    targetUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reasonResult = normalizeSystemAdminReason(args.reason);
    if (!reasonResult.success) {
      throw new ConvexError(getNormalizeReasonErrorMessage(reasonResult.error));
    }
    const reason = reasonResult.reason;
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new ConvexError("対象グループが存在しません");
    if (group.status !== "active") {
      throw new ConvexError("削除中・削除済み・アーカイブ済みグループは復旧できません");
    }
    const owners = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_role", (q) => q.eq("groupId", args.groupId).eq("role", "owner"))
      .take(MAX_OWNERS + 1);
    if (owners.length > MAX_OWNERS) throw new ConvexError("owner数が上限を超えています");
    if (owners.length > 0)
      throw new ConvexError("ownerが存在するグループは通常のowner操作を使ってください");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", args.groupId).eq("userId", target.userId),
      )
      .unique();
    if (!membership || membership.role !== "member") {
      throw new ConvexError("対象ユーザーは既存memberではありません");
    }
    await ctx.db.patch(membership._id, { role: "owner", updatedAt: Date.now() });
    const auditId = await ctx.db.insert("systemAdminAuditLogs", {
      action: "system_admin_ownerless_group_recovered",
      actorType: "system_admin",
      actorUserId: actor.user._id,
      targetKind: "group",
      targetUserId: target._id,
      targetId: args.groupId,
      targetDisplayNameSnapshot: group.name,
      reason,
      beforeOwnerCount: 0,
      afterOwnerCount: 1,
      result: "success",
      createdAt: Date.now(),
    });
    await enqueueNotifications(ctx, target._id, args.groupId, auditId);
    return null;
  },
});

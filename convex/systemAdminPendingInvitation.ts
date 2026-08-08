import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSystemAdmin } from "./systemAdmins";
import { normalizeSystemAdminReason } from "../lib/domain/systemAdmin/reason";

const ACTION = "system_admin_group_invitation_revoked" as const;

function normalizeReason(reason: string) {
  const result = normalizeSystemAdminReason(reason);
  if (!result.success) {
    throw new ConvexError("理由は1〜500文字で入力してください");
  }
  return result.reason;
}

async function readPendingInvitation(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
  invitationId: Id<"groupInvitations">,
) {
  const group = await ctx.db.get(groupId);
  if (!group || group.status !== "active") {
    throw new ConvexError("active状態のgroupだけを指定できます");
  }
  const invitation = await ctx.db.get(invitationId);
  if (!invitation) throw new ConvexError("招待が見つかりません");
  if (invitation.groupId !== groupId) throw new ConvexError("招待のgroup指定が一致しません");
  if (invitation.status !== "pending") {
    throw new ConvexError("pending招待だけを取り消せます");
  }
  return { group, invitation };
}

export const getPendingInvitationForSystemAdmin = internalQuery({
  args: {
    groupId: v.id("groups"),
    invitationId: v.id("groupInvitations"),
    reason: v.string(),
  },
  returns: v.object({
    groupId: v.id("groups"),
    invitationId: v.id("groupInvitations"),
    groupName: v.string(),
    email: v.string(),
    clerkInvitationId: v.optional(v.string()),
    reason: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    const { group, invitation } = await readPendingInvitation(ctx, args.groupId, args.invitationId);
    return {
      groupId: group._id,
      invitationId: invitation._id,
      groupName: group.name,
      email: invitation.email,
      clerkInvitationId: invitation.clerkInvitationId,
      reason,
    };
  },
});

async function enqueueNotifications(
  ctx: MutationCtx,
  auditId: Id<"systemAdminAuditLogs">,
  groupId: Id<"groups">,
  invitationId: Id<"groupInvitations">,
  email: string,
) {
  const recipients = new Set<Id<"users">>();
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

  const payloadJson = JSON.stringify({ action: ACTION, groupId, invitationId, email });
  const now = Date.now();
  for (const recipientUserId of recipients) {
    const dedupeKey = `${auditId}:user:${recipientUserId}`;
    await ctx.db.insert("systemAdminNotifications", {
      action: ACTION,
      recipientUserId,
      targetEmailSnapshot: email,
      dedupeKey,
      payloadJson,
      createdAt: now,
    });
  }
  await ctx.db.insert("systemAdminNotifications", {
    action: ACTION,
    recipientEmail: email,
    targetEmailSnapshot: email,
    dedupeKey: `${auditId}:email:${email}`,
    payloadJson,
    createdAt: now,
  });
}

async function insertAudit(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<"users">;
    groupId: Id<"groups">;
    groupName: string;
    invitationId: Id<"groupInvitations">;
    email: string;
    reason: string;
    result: "success" | "denied";
  },
) {
  return await ctx.db.insert("systemAdminAuditLogs", {
    action: ACTION,
    actorType: "system_admin",
    actorUserId: args.actorUserId,
    targetKind: "invitation",
    targetId: args.invitationId,
    targetDisplayNameSnapshot: args.email,
    sourceGroupId: args.groupId,
    sourceGroupNameSnapshot: args.groupName,
    reason: args.reason,
    result: args.result,
    createdAt: Date.now(),
  });
}

export const completePendingInvitation = internalMutation({
  args: {
    groupId: v.id("groups"),
    invitationId: v.id("groupInvitations"),
    reason: v.string(),
    expectedClerkInvitationId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    const { group, invitation } = await readPendingInvitation(ctx, args.groupId, args.invitationId);
    if (invitation.clerkInvitationId !== args.expectedClerkInvitationId) {
      throw new ConvexError("招待状態が変わったため再読み込みしてください");
    }
    await ctx.db.patch(invitation._id, { status: "revoked", updatedAt: Date.now() });
    const auditId = await insertAudit(ctx, {
      actorUserId: actor.user._id,
      groupId: group._id,
      groupName: group.name,
      invitationId: invitation._id,
      email: invitation.email,
      reason,
      result: "success",
    });
    await enqueueNotifications(ctx, auditId, group._id, invitation._id, invitation.email);
    return null;
  },
});

export const recordRevokeFailure = internalMutation({
  args: {
    groupId: v.id("groups"),
    invitationId: v.id("groupInvitations"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    const { group, invitation } = await readPendingInvitation(ctx, args.groupId, args.invitationId);
    await insertAudit(ctx, {
      actorUserId: actor.user._id,
      groupId: group._id,
      groupName: group.name,
      invitationId: invitation._id,
      email: invitation.email,
      reason,
      result: "denied",
    });
    return null;
  },
});

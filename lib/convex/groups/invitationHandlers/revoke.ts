import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { assertActiveGroupScope } from "../../../../convex/groups/adminGuards";
import {
  invitationEmailsMatch,
  normalizeEmail,
} from "../../../../convex/groups/lib/groupEmailMatching";
import { readQueryDocs } from "../../../../convex/groups/lib/groupQueryHelpers";
import { recordManagementAuditLog } from "../../../../convex/groups/lib/managementAuditLog";
import { requireGroupOwner } from "../../../../convex/groups/membership";

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

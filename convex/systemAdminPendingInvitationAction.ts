"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getClerkClient } from "../lib/convex/groups/clerkInvitationLib/inviteActions";

type RevokeDeps = {
  revokeInvitation: (invitationId: string) => Promise<unknown>;
};

export async function systemAdminPendingInvitationRevokeHandler(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  args: { groupId: Id<"groups">; invitationId: Id<"groupInvitations">; reason: string },
  deps?: RevokeDeps,
) {
  const pending = await ctx.runQuery(
    internal.systemAdminPendingInvitation.getPendingInvitationForSystemAdmin,
    args,
  );
  try {
    if (pending.clerkInvitationId) {
      const clerk = deps?.revokeInvitation ? deps : getClerkClient().invitations;
      await clerk.revokeInvitation(pending.clerkInvitationId);
    }
    await ctx.runMutation(internal.systemAdminPendingInvitation.completePendingInvitation, {
      groupId: pending.groupId,
      invitationId: pending.invitationId,
      reason: pending.reason,
      expectedClerkInvitationId: pending.clerkInvitationId,
    });
    return null;
  } catch (caughtError) {
    try {
      await ctx.runMutation(internal.systemAdminPendingInvitation.recordRevokeFailure, {
        groupId: pending.groupId,
        invitationId: pending.invitationId,
        reason: "招待取消の外部連携またはConvex確定に失敗",
      });
    } catch {
      // Original error is more actionable; failure audit is best-effort.
    }
    if (caughtError instanceof ConvexError) throw caughtError;
    throw new ConvexError("Clerk招待の取消に失敗しました。状態はpendingのままです");
  }
}

export const systemAdminPendingInvitationRevoke = action({
  args: {
    groupId: v.id("groups"),
    invitationId: v.id("groupInvitations"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: systemAdminPendingInvitationRevokeHandler,
});

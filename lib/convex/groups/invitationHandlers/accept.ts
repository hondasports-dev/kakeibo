import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { invitationEmailsMatchAny } from "../../../../convex/groups/lib/groupEmailMatching";
import { readQueryDoc } from "../../../../convex/groups/lib/groupQueryHelpers";
import { revokeGroupInvitationsForEmailInGroup } from "./staleCleanup";
import { assertAccountDeletionNotInProgress } from "../../../../convex/accountDeletion";
import { GROUP_ADMIN_ERRORS } from "../../../../convex/groups/adminGuards";

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

  const group = await ctx.db.get(invite.groupId);
  if (
    group === null ||
    group.status === "deleting" ||
    group.status === "deleted" ||
    group.status === "archived"
  ) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_DELETING);
  }

  if (!invitationEmailsMatchAny(args.acceptedEmails, invite.email)) {
    throw new ConvexError("招待先メールアドレスと一致しません");
  }
  await assertAccountDeletionNotInProgress(ctx, args.acceptedUserId);

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

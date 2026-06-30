import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { setGroupClerkOrganizationIdHandler } from "./e2e";
import { invitationEmailsMatch, normalizeEmail } from "./lib/groupEmailMatching";
import { readQueryDoc, readQueryDocs } from "./lib/groupQueryHelpers";

export {
  dedupePendingGroupInvitationsByEmail,
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  sortPendingGroupInvitationsForDisplay,
} from "./lib/groupEmailMatching";

export {
  revokePendingGroupInvitationsForEmailInGroup,
  cancelPendingGroupInvitationHandler,
} from "../../lib/convex/groups/invitationHandlers/revoke";
export { revokeGroupInvitationsForEmailInGroup } from "../../lib/convex/groups/invitationHandlers/staleCleanup";
export {
  acceptGroupInvitationForVerifiedEmailsHandler,
  acceptGroupInvitationHandler,
} from "../../lib/convex/groups/invitationHandlers/accept";

import { cancelPendingGroupInvitationHandler } from "../../lib/convex/groups/invitationHandlers/revoke";
import {
  acceptGroupInvitationForVerifiedEmailsHandler,
  acceptGroupInvitationHandler,
} from "../../lib/convex/groups/invitationHandlers/accept";
import { revokeGroupInvitationsForEmailInGroup } from "../../lib/convex/groups/invitationHandlers/staleCleanup";

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

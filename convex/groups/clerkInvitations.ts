"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  cancelPendingGroupInvitationHandler,
  inviteMemberHandler,
  getClerkClient,
} from "../../lib/convex/groups/clerkInvitationLib/inviteActions";
import {
  getClerkUserDisplayName,
  getPrimaryVerifiedClerkEmailAddress,
  getVerifiedClerkEmailAddresses,
  type ClerkUserWithEmails,
} from "../../lib/convex/groups/clerkInvitationLib/userHelpers";

export {
  buildClerkInvitationParams,
  buildInvitationRedirectUrl,
  getConfiguredRedirectOrigins,
  isAllowedRedirectOrigin,
} from "../../lib/convex/groups/clerkInvitationLib/redirectUrls";
export {
  getClerkUserDisplayName,
  getPrimaryVerifiedClerkEmailAddress,
  getVerifiedClerkEmailAddresses,
} from "../../lib/convex/groups/clerkInvitationLib/userHelpers";
export {
  cancelPendingGroupInvitationHandler,
  inviteMemberHandler,
} from "../../lib/convex/groups/clerkInvitationLib/inviteActions";

export const inviteMember = action({
  args: {
    email: v.string(),
    redirectUrl: v.string(),
  },
  handler: inviteMemberHandler,
});

export const cancelPendingGroupInvitation = action({
  args: {
    invitationId: v.id("groupInvitations"),
  },
  returns: v.null(),
  handler: cancelPendingGroupInvitationHandler,
});

export const acceptInvitation = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"groups">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Not authenticated");
    }

    const acceptedEmails = new Set<string>();
    if (identity.email) {
      acceptedEmails.add(identity.email.trim().toLowerCase());
    }
    let displayName = identity.name ?? identity.email ?? "ユーザー";
    let profileEmail = identity.email?.trim().toLowerCase();

    try {
      const clerk = getClerkClient();
      const user = (await clerk.users.getUser(identity.subject)) as ClerkUserWithEmails;
      const verifiedEmails = getVerifiedClerkEmailAddresses(user);
      for (const email of verifiedEmails) {
        acceptedEmails.add(email);
      }
      profileEmail = getPrimaryVerifiedClerkEmailAddress(user) ?? profileEmail;
      displayName = getClerkUserDisplayName(user, profileEmail);
    } catch (caughtError) {
      console.warn(
        "[groups.clerkInvitations.acceptInvitation] failed to fetch Clerk user emails; falling back to identity email only",
        caughtError instanceof Error ? caughtError.name : "UnknownError",
      );
    }

    await ctx.runMutation(internal.users.internal.upsertUserProfile, {
      userId: identity.tokenIdentifier,
      displayName,
      ...(profileEmail ? { email: profileEmail } : {}),
    });

    return await ctx.runMutation(
      internal.groups.invitations.acceptGroupInvitationForVerifiedEmails,
      {
        token: args.token,
        acceptedUserId: identity.tokenIdentifier,
        acceptedEmails: [...acceptedEmails],
      },
    );
  },
});

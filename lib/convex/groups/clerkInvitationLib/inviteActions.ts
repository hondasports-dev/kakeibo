"use node";

import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import type { ActionCtx } from "../../../../convex/_generated/server";
import { api, internal } from "../../../../convex/_generated/api";
import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel";
import { assertGroupOwnerRole } from "../../../../convex/groups/adminGuards";
import { buildClerkInvitationParams, buildInvitationRedirectUrl } from "./redirectUrls";

type MyGroup = {
  _id: Id<"groups">;
  name: string;
  clerkOrganizationId: string | null;
  role: "owner" | "member";
  createdAt: number;
} | null;

type InviteMemberResult = {
  token: string;
  clerkInvitationId: string;
  clerkOrganizationId: string | null;
};

type InviteMemberArgs = {
  email: string;
  redirectUrl: string;
};

type ClerkInvitationClient = {
  invitations: Pick<ReturnType<typeof getClerkClient>["invitations"], "createInvitation">;
};

type InviteMemberDeps = {
  createToken: () => string;
  getClerkClient: () => ClerkInvitationClient;
};

type CancelPendingGroupInvitationArgs = {
  invitationId: Id<"groupInvitations">;
};

type CancelPendingGroupInvitationDeps = {
  getClerkClient: () => {
    invitations: {
      revokeInvitation: (invitationId: string) => Promise<unknown>;
    };
  };
};

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return normalized;
}

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ConvexError(
      "CLERK_SECRET_KEY が設定されていません。Convex Dashboard で環境変数を設定してください",
    );
  }

  return createClerkClient({ secretKey });
}

export async function cancelPendingGroupInvitationHandler(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  args: CancelPendingGroupInvitationArgs,
  deps: CancelPendingGroupInvitationDeps = {
    getClerkClient,
  },
): Promise<null> {
  const group: MyGroup = await ctx.runQuery(api.groups.queries.getMyGroup, {});
  if (!group) {
    throw new ConvexError("グループを選択してください");
  }
  assertGroupOwnerRole(group.role);

  const { clerkInvitationIds } = await ctx.runMutation(
    api.groups.invitations.cancelPendingGroupInvitation,
    {
      invitationId: args.invitationId,
    },
  );

  const clerk = deps.getClerkClient();
  for (const clerkInvitationId of clerkInvitationIds) {
    try {
      await clerk.invitations.revokeInvitation(clerkInvitationId);
    } catch (caughtError) {
      console.warn(
        "[groups.clerkInvitations.cancelPendingGroupInvitation] failed to revoke Clerk invitation",
        caughtError instanceof Error ? caughtError.name : "UnknownError",
      );
    }
  }

  return null;
}

export async function inviteMemberHandler(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  args: InviteMemberArgs,
  deps: InviteMemberDeps = {
    createToken: randomUUID,
    getClerkClient,
  },
): Promise<InviteMemberResult> {
  const group: MyGroup = await ctx.runQuery(api.groups.queries.getMyGroup, {});
  if (!group) {
    throw new ConvexError("グループを選択してください");
  }
  assertGroupOwnerRole(group.role);
  const currentUserId: string = await ctx.runQuery(api.users.queries.getAuthenticatedUserId, {});

  const email = normalizeEmail(args.email);
  const token = deps.createToken();
  const redirectUrl = buildInvitationRedirectUrl(args.redirectUrl, token);

  await ctx.runMutation(internal.groups.invitations.createGroupInvitationRecord, {
    groupId: group._id,
    email,
    token,
    invitedByUserId: currentUserId,
  });

  const clerk = deps.getClerkClient();
  let invitation: { id: string };
  try {
    invitation = await clerk.invitations.createInvitation(
      buildClerkInvitationParams(email, redirectUrl, group._id, token),
    );
  } catch (caughtError) {
    try {
      await ctx.runMutation(internal.groups.invitations.deletePendingGroupInvitationRecordByToken, {
        token,
      });
    } catch (cleanupError) {
      console.warn(
        "[groups.clerkInvitations.inviteMember] failed to clean up reserved invitation",
        cleanupError instanceof Error ? cleanupError.name : "UnknownError",
      );
    }
    throw caughtError;
  }

  await ctx.runMutation(internal.groups.invitations.createGroupInvitationRecord, {
    groupId: group._id,
    email,
    token,
    invitedByUserId: currentUserId,
    clerkInvitationId: invitation.id,
  });

  return {
    token,
    clerkInvitationId: invitation.id,
    clerkOrganizationId: group.clerkOrganizationId,
  };
}

export { getClerkClient };

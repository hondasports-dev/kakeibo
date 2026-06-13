"use node";

import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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

type ClerkEmailAddress = {
  id: string;
  emailAddress: string;
  verification: { status?: string } | null;
};

type ClerkUserWithEmails = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: ClerkEmailAddress[];
  primaryEmailAddressId?: string | null;
};

const INVITATION_ACCEPT_PATH = "/group/invitations/accept";
const KAKEIBO_PRODUCTION_HOSTNAME = "kakeibo.vercel.app";

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return normalized;
}

export function getConfiguredRedirectOrigins() {
  const raw = process.env.INVITATION_REDIRECT_ORIGINS ?? "";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        throw new ConvexError("INVITATION_REDIRECT_ORIGINS contains an invalid URL");
      }
    });
}

export function isAllowedRedirectOrigin(url: URL) {
  const configuredOrigins = getConfiguredRedirectOrigins();
  if (configuredOrigins.includes(url.origin)) {
    return true;
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocalhost && (url.protocol === "http:" || url.protocol === "https:")) {
    return true;
  }

  if (url.hostname === KAKEIBO_PRODUCTION_HOSTNAME) {
    return true;
  }

  return /^kakeibo-[a-z0-9-]+\.vercel\.app$/i.test(url.hostname);
}

export function buildInvitationRedirectUrl(rawRedirectUrl: string, token: string) {
  let url: URL;
  try {
    url = new URL(rawRedirectUrl);
  } catch {
    throw new ConvexError("招待リンクの戻り先URLが不正です");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConvexError("招待リンクの戻り先URLが不正です");
  }
  if (url.username || url.password || url.hash || url.pathname !== INVITATION_ACCEPT_PATH) {
    throw new ConvexError("招待リンクの戻り先URLが不正です");
  }
  if (!isAllowedRedirectOrigin(url)) {
    throw new ConvexError("招待リンクの戻り先URLが許可されていません");
  }

  url.searchParams.set("token", token);
  return url.toString();
}

export function buildClerkInvitationParams(
  emailAddress: string,
  redirectUrl: string,
  groupId: Id<"groups">,
  token: string,
) {
  return {
    emailAddress,
    redirectUrl,
    ignoreExisting: true,
    publicMetadata: {
      groupId,
      token,
    },
  };
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

export function getVerifiedClerkEmailAddresses(user: ClerkUserWithEmails) {
  return (user.emailAddresses ?? [])
    .filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

export function getClerkUserDisplayName(user: ClerkUserWithEmails, fallbackEmail?: string) {
  const username = user.username?.trim();
  const displayName = [user.firstName, user.lastName]
    .map((name) => name?.trim())
    .filter(Boolean)
    .join(" ");
  return username || displayName || fallbackEmail || "ユーザー";
}

export function getPrimaryVerifiedClerkEmailAddress(user: ClerkUserWithEmails) {
  const verifiedEmails = getVerifiedClerkEmailAddresses(user);
  const primaryEmail = (user.emailAddresses ?? []).find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (
    primaryEmail?.verification?.status === "verified" &&
    primaryEmail.emailAddress.trim().length > 0
  ) {
    return primaryEmail.emailAddress.trim().toLowerCase();
  }
  return verifiedEmails[0];
}

export const inviteMember = action({
  args: {
    email: v.string(),
    redirectUrl: v.string(),
  },
  handler: async (ctx, args): Promise<InviteMemberResult> => {
    const group: MyGroup = await ctx.runQuery(api.groups.getMyGroup, {});
    if (!group) {
      throw new ConvexError("グループを選択してください");
    }
    if (group.role !== "owner") {
      throw new ConvexError("グループオーナーのみメンバーを招待できます");
    }
    const currentUserId: string = await ctx.runQuery(api.users.getAuthenticatedUserId, {});

    const email = normalizeEmail(args.email);
    const token = randomUUID();
    const redirectUrl = buildInvitationRedirectUrl(args.redirectUrl, token);
    const clerk = getClerkClient();

    const invitation = await clerk.invitations.createInvitation(
      buildClerkInvitationParams(email, redirectUrl, group._id, token),
    );

    await ctx.runMutation(internal.groups.createGroupInvitationRecord, {
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
  },
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
        "[groupInvitations.acceptInvitation] failed to fetch Clerk user emails; falling back to identity email only",
        caughtError instanceof Error ? caughtError.name : "UnknownError",
      );
    }

    await ctx.runMutation(internal.users.upsertUserProfile, {
      userId: identity.tokenIdentifier,
      displayName,
      ...(profileEmail ? { email: profileEmail } : {}),
    });

    return await ctx.runMutation(internal.groups.acceptGroupInvitationForVerifiedEmails, {
      token: args.token,
      acceptedUserId: identity.tokenIdentifier,
      acceptedEmails: [...acceptedEmails],
    });
  },
});

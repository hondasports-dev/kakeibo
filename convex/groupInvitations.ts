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
  clerkOrganizationId: string;
};

const INVITATION_ACCEPT_PATH = "/group/invitations/accept";

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return normalized;
}

function getConfiguredRedirectOrigins() {
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

function isAllowedRedirectOrigin(url: URL) {
  const configuredOrigins = getConfiguredRedirectOrigins();
  if (configuredOrigins.includes(url.origin)) {
    return true;
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocalhost && (url.protocol === "http:" || url.protocol === "https:")) {
    return true;
  }

  return /^kakeibo(?:-[a-z0-9-]+)?-hondasports-projects\.vercel\.app$/i.test(url.hostname);
}

function buildInvitationRedirectUrl(rawRedirectUrl: string, token: string) {
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

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ConvexError("CLERK_SECRET_KEY is not set");
  }

  return createClerkClient({ secretKey });
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

    let clerkOrganizationId: string | null = group.clerkOrganizationId;
    if (!clerkOrganizationId) {
      const createdGroupOrganization = await clerk.organizations.createOrganization({
        name: group.name,
        createdBy: currentUserId,
      });
      clerkOrganizationId = createdGroupOrganization.id;
      await ctx.runMutation(internal.groups.setGroupClerkOrganizationId, {
        groupId: group._id,
        clerkOrganizationId,
      });
    }

    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: clerkOrganizationId,
      inviterUserId: currentUserId,
      emailAddress: email,
      role: "org:member",
      redirectUrl,
      publicMetadata: {
        groupId: group._id,
        token,
      },
    });

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
      clerkOrganizationId,
    };
  },
});

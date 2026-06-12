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

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ConvexError(
      "CLERK_SECRET_KEY が設定されていません。Convex Dashboard で環境変数を設定してください",
    );
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

    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
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
      clerkOrganizationId: group.clerkOrganizationId,
    };
  },
});

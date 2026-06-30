import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel";

const INVITATION_ACCEPT_PATH = "/group/invitations/accept";
const KAKEIBO_PRODUCTION_HOSTNAME = "kakeibo.vercel.app";

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

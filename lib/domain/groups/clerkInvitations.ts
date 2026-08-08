export const INVITATION_ACCEPT_PATH = "/group/invitations/accept";
export const KAKEIBO_PRODUCTION_HOSTNAME = "kakeibo.vercel.app";

export type InvitationRedirectError =
  | "invalid_url"
  | "invalid_protocol"
  | "invalid_path"
  | "not_allowed";

export type BuildInvitationRedirectUrlResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: InvitationRedirectError };

export function isAllowedRedirectOrigin(url: URL, configuredOrigins: string[]): boolean {
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

export function buildInvitationRedirectUrl(
  rawRedirectUrl: string,
  token: string,
  configuredOrigins: string[],
): BuildInvitationRedirectUrlResult {
  let url: URL;
  try {
    url = new URL(rawRedirectUrl);
  } catch {
    return { success: false, error: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { success: false, error: "invalid_protocol" };
  }
  if (url.username || url.password || url.hash || url.pathname !== INVITATION_ACCEPT_PATH) {
    return { success: false, error: "invalid_path" };
  }
  if (!isAllowedRedirectOrigin(url, configuredOrigins)) {
    return { success: false, error: "not_allowed" };
  }

  url.searchParams.set("token", token);
  return { success: true, redirectUrl: url.toString() };
}

export function buildClerkInvitationParams(
  emailAddress: string,
  redirectUrl: string,
  groupId: string,
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

export function buildInvitationFallbackUrl(token: string | null): string {
  return token
    ? `${INVITATION_ACCEPT_PATH}?token=${encodeURIComponent(token)}`
    : INVITATION_ACCEPT_PATH;
}

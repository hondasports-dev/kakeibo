export const OAUTH_CALLBACK_PATH = "/sso-callback";
export const GROUP_INVITATION_ACCEPT_PATH = "/group/invitations/accept";
export const UPDATES_PATH = "/updates";
/** E2E専用: AppErrorBoundary の fallback UI 検証用（開発時のみ） */
export const E2E_APP_ERROR_BOUNDARY_PATH = "/__e2e__/app-error-boundary";

/** 認証・グループ選択なしで閲覧できる公開パス */
export const PUBLIC_PATHS = [
  "/privacy",
  "/terms",
  "/maintenance",
  UPDATES_PATH,
  GROUP_INVITATION_ACCEPT_PATH,
] as const;

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

const AUTHENTICATED_APP_EXACT_PATHS = [
  "/",
  "/guide",
  "/search",
  "/categories",
  "/group/setup",
  "/group/select",
] as const;

const AUTHENTICATED_APP_PREFIXES = [
  "/years/",
  "/months/",
  "/weeks/",
  "/settings",
  "/admin",
  "/group/delete/",
  "/__e2e__/",
] as const;

function matchesAuthenticatedPrefix(pathname: string, prefix: string): boolean {
  if (prefix.endsWith("/")) {
    return pathname.startsWith(prefix);
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** ログイン後に AuthenticatedApp を通すべき家計・管理画面か */
export function isAuthenticatedAppPath(pathname: string): boolean {
  if ((AUTHENTICATED_APP_EXACT_PATHS as readonly string[]).includes(pathname)) {
    return true;
  }
  return AUTHENTICATED_APP_PREFIXES.some((prefix) => matchesAuthenticatedPrefix(pathname, prefix));
}

/**
 * 未ログインでもルーターへ渡し、公開ページや 404 を表示できるパスか。
 * 家計画面は AuthenticatedApp を通し、未定義 URL だけ認証前 404 にする（#253/#266）。
 */
export function shouldUseRouterBeforeAuth(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return true;
  }
  if (isAuthenticatedAppPath(pathname)) {
    return false;
  }
  return true;
}

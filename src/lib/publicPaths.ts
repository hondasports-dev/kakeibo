export const OAUTH_CALLBACK_PATH = "/sso-callback";
export const GROUP_INVITATION_ACCEPT_PATH = "/group/invitations/accept";

/** 認証・グループ選択なしで閲覧できる公開パス */
export const PUBLIC_PATHS = ["/privacy", "/terms", GROUP_INVITATION_ACCEPT_PATH] as const;

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

/** 未ログインでもルーターへ渡し、404 等を表示できるパスか */
export function shouldUseRouterBeforeAuth(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return true;
  }
  return pathname !== "/";
}

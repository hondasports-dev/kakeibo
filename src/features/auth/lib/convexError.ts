/**
 * Convex mutation / action の失敗からユーザー向けメッセージを取得する。
 * Convex クライアントは Error.message にサーバー側の ConvexError を載せる。
 */
export function getConvexErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
}

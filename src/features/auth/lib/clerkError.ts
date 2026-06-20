/**
 * Clerk のエラーオブジェクトからユーザー向けメッセージを取得する。
 * errors[0].longMessage → errors[0].message → fallbackMessage の優先順で返す。
 */
export function getClerkErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error == null) return fallbackMessage;
  const clerkError = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
  };
  return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? fallbackMessage;
}

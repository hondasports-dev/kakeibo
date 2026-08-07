/** メールアドレスを正規化する。trim して小文字化し、空文字は undefined にする。 */
export function normalizeEmail(email: string | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

/**
 * メール CTA 用の絶対 URL を組み立てる。
 * process.env.APP_BASE_URL を基準にする。末尾スラッシュの重複を防ぐ。
 */
export function getAppBaseUrl(): string {
  const url = process.env.APP_BASE_URL ?? "http://localhost:5173";
  return url.replace(/\/$/, "");
}

export function buildEmailUrl(path: string): string {
  const base = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

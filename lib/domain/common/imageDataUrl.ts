/**
 * 画像 data URL に関する共有ドメインルール。
 * Convex の string 値の 1MB 制限を下回る安全な最大長。
 */
export const MAX_IMAGE_DATA_URL_LENGTH = 900_000;

export type ImageDataUrlError =
  | "invalid_format"
  | "missing_base64_marker"
  | "too_large"
  | "empty_base64"
  | "unsupported_mime_type"
  | "invalid_base64";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const BASE64_MARKER = ";base64,";

function isValidBase64(value: string): boolean {
  if (value.length === 0) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  const trailingEquals = value.match(/=+$/);
  const padding = trailingEquals ? trailingEquals[0] : "";
  const body = value.slice(0, value.length - padding.length);
  if (padding.length > 2) return false;
  if (padding.length > 0 && body.length === 0) return false;
  if (body.includes("=")) return false;
  return true;
}

/**
 * imageDataUrl の形式を検証する。
 * - "data:image/{jpeg,png,webp,gif};base64,..." の形式である必要がある
 * - 実際に base64 デコード可能な文字列である必要がある
 * - MAX_IMAGE_DATA_URL_LENGTH 文字以内である必要がある
 */
export function validateImageDataUrl(
  imageDataUrl: string,
): { success: true } | { success: false; error: ImageDataUrlError } {
  if (!imageDataUrl.startsWith("data:")) {
    return { success: false, error: "invalid_format" };
  }

  const markerIndex = imageDataUrl.indexOf(BASE64_MARKER);
  if (markerIndex === -1) {
    return { success: false, error: "missing_base64_marker" };
  }

  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return { success: false, error: "too_large" };
  }

  const header = imageDataUrl.slice(5, markerIndex);
  const base64Body = imageDataUrl.slice(markerIndex + BASE64_MARKER.length);
  if (base64Body.length === 0) {
    return { success: false, error: "empty_base64" };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(header.toLowerCase())) {
    return { success: false, error: "unsupported_mime_type" };
  }

  if (!isValidBase64(base64Body)) {
    return { success: false, error: "invalid_base64" };
  }

  return { success: true };
}

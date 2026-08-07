import { ConvexError } from "convex/values";
import { validateExtractedIsoDate } from "../../../lib/domain/receipt/receiptExtraction";
import { MAX_IMAGE_DATA_URL_LENGTH } from "./types";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const BASE64_MARKER = ";base64,";

function isValidBase64(value: string): boolean {
  if (value.length === 0) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  const trailingEquals = value.match(/=+$/);
  const padding = trailingEquals ? trailingEquals[0] : "";
  const body = value.slice(0, value.length - padding.length);
  // パディングは末尾に 0〜2 個のみ許可
  if (padding.length > 2) return false;
  if (padding.length > 0 && body.length === 0) return false;
  // 本体中に '=' は含まれない
  if (body.includes("=")) return false;
  return true;
}

/**
 * imageDataUrl の形式を検証する。
 * - "data:image/{jpeg,png,webp,gif};base64,..." の形式である必要がある
 * - 実際に base64 デコード可能な文字列である必要がある
 * - MAX_IMAGE_DATA_URL_LENGTH 文字以内である必要がある
 */
export function validateImageDataUrl(imageDataUrl: string): void {
  if (!imageDataUrl.startsWith("data:")) {
    throw new ConvexError("imageDataUrl は Data URL 形式で指定してください");
  }

  const markerIndex = imageDataUrl.indexOf(BASE64_MARKER);
  if (markerIndex === -1) {
    throw new ConvexError(
      "imageDataUrl は base64 エンコードされた Data URL 形式で指定してください",
    );
  }

  // サイズはフォーマット詳細を調べる前にチェックし、巨大な入力に対する不要な検証を防ぐ
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new ConvexError(
      "画像サイズが大きすぎます。長辺 1400〜1800px・JPEG にリサイズしてから再試行してください",
    );
  }

  const header = imageDataUrl.slice(5, markerIndex);
  const base64Body = imageDataUrl.slice(markerIndex + BASE64_MARKER.length);
  if (base64Body.length === 0) {
    throw new ConvexError("imageDataUrl の base64 データが空です");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(header.toLowerCase())) {
    throw new ConvexError("対応していない画像形式です。JPEG / PNG / WebP / GIF を使用してください");
  }

  if (!isValidBase64(base64Body)) {
    throw new ConvexError("imageDataUrl の base64 エンコーディングが不正です");
  }
}

export function validateExtractedDate(date: string): void {
  const result = validateExtractedIsoDate(date);
  if (!result.success) {
    throw new ConvexError("OpenAI レスポンスの date が実在する YYYY-MM-DD 形式ではありません");
  }
}

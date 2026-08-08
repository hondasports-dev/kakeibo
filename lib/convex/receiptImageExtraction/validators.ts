import { ConvexError } from "convex/values";
import { validateExtractedIsoDate } from "../../../lib/domain/receipt/receiptExtraction";
import {
  validateImageDataUrl as validateImageDataUrlDomain,
  type ImageDataUrlError,
} from "../../../lib/domain/common/imageDataUrl";

const imageDataUrlErrorMessages: Record<ImageDataUrlError, string> = {
  invalid_format: "imageDataUrl は Data URL 形式で指定してください",
  missing_base64_marker: "imageDataUrl は base64 エンコードされた Data URL 形式で指定してください",
  too_large:
    "画像サイズが大きすぎます。長辺 1400〜1800px・JPEG にリサイズしてから再試行してください",
  empty_base64: "imageDataUrl の base64 データが空です",
  unsupported_mime_type: "対応していない画像形式です。JPEG / PNG / WebP / GIF を使用してください",
  invalid_base64: "imageDataUrl の base64 エンコーディングが不正です",
};

export function validateImageDataUrl(imageDataUrl: string): void {
  const result = validateImageDataUrlDomain(imageDataUrl);
  if (!result.success) {
    throw new ConvexError(imageDataUrlErrorMessages[result.error]);
  }
}

export function validateExtractedDate(date: string): void {
  const result = validateExtractedIsoDate(date);
  if (!result.success) {
    throw new ConvexError("OpenAI レスポンスの date が実在する YYYY-MM-DD 形式ではありません");
  }
}

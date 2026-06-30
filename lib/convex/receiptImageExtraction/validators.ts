import { ConvexError } from "convex/values";
import { MAX_IMAGE_DATA_URL_LENGTH } from "./types";

/**
 * imageDataUrl の形式を検証する。
 * - "data:image/" で始まる必要がある
 * - ";base64," を含む必要がある
 * - 5,000,000 文字以内である必要がある
 */
export function validateImageDataUrl(imageDataUrl: string): void {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new ConvexError("imageDataUrl は data:image/ で始まる Data URL 形式で指定してください");
  }
  if (!imageDataUrl.includes(";base64,")) {
    throw new ConvexError(
      "imageDataUrl は base64 エンコードされた Data URL 形式で指定してください",
    );
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new ConvexError(
      "画像サイズが大きすぎます。長辺 1400〜1800px・JPEG にリサイズしてから再試行してください",
    );
  }
}

export function validateExtractedDate(date: string): void {
  if (date === "") {
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError("OpenAI レスポンスの date は YYYY-MM-DD 形式である必要があります");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ConvexError("OpenAI レスポンスの date が実在する日付ではありません");
  }
  const normalized = parsedDate.toISOString().slice(0, 10);
  if (normalized !== date) {
    throw new ConvexError("OpenAI レスポンスの date が実在する日付ではありません");
  }
}

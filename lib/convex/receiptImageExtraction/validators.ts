import { ConvexError } from "convex/values";
import { validateExtractedIsoDate } from "../../../lib/domain/receipt/receiptExtraction";
import {
  getImageDataUrlErrorMessage,
  validateImageDataUrl as validateImageDataUrlDomain,
} from "../../../lib/domain/common/imageDataUrl";

export function validateImageDataUrl(imageDataUrl: string): void {
  const result = validateImageDataUrlDomain(imageDataUrl);
  if (!result.success) {
    throw new ConvexError(getImageDataUrlErrorMessage(result.error));
  }
}

export function validateExtractedDate(date: string): void {
  const result = validateExtractedIsoDate(date);
  if (!result.success) {
    throw new ConvexError("OpenAI レスポンスの date が実在する YYYY-MM-DD 形式ではありません");
  }
}

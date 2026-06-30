import { ConvexError } from "convex/values";
import { isDiscountItemName } from "../../../convex/lib/discountItems";
import type {
  ExtractedFields,
  ExtractionConfidence,
  ExtractReceiptItemResult,
  OpenAIResponsesApiResponse,
} from "./types";
import { MAX_EXTRACTED_LINE_ITEMS } from "./types";
import { validateExtractedDate } from "./validators";

/** OpenAI Responses API のレスポンスから抽出結果を取り出す */
export function parseOpenAIResponse(data: OpenAIResponsesApiResponse): ExtractedFields {
  const message = data.output?.find((o) => o.type === "message");
  const textContent = message?.content?.find((c) => c.type === "output_text");
  if (!textContent?.text) {
    throw new ConvexError("OpenAI からのレスポンスに期待するテキストコンテンツが含まれていません");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent.text);
  } catch {
    throw new ConvexError("OpenAI からのレスポンスを JSON としてパースできませんでした");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ConvexError("OpenAI レスポンスが期待する形式ではありません");
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.shopName !== "string") {
    throw new ConvexError("OpenAI レスポンスの shopName が文字列ではありません");
  }
  if (typeof obj.date !== "string") {
    throw new ConvexError("OpenAI レスポンスの date が文字列ではありません");
  }
  validateExtractedDate(obj.date);
  if (typeof obj.amountYen !== "number") {
    throw new ConvexError("OpenAI レスポンスの amountYen が数値ではありません");
  }
  if (!Number.isInteger(obj.amountYen) || obj.amountYen < 0) {
    throw new ConvexError("OpenAI レスポンスの amountYen は 0 以上の整数である必要があります");
  }
  const confidence = parseConfidence(obj.confidence);

  const documentType = parseOptionalDocumentType(obj.documentType);
  const paymentPlace = parseOptionalString(obj.paymentPlace, "paymentPlace");
  const payeeName = parseOptionalString(obj.payeeName, "payeeName");
  const paymentPurpose = parseOptionalString(obj.paymentPurpose, "paymentPurpose");
  const categoryName = parseOptionalString(obj.categoryName, "categoryName");
  const items = parseOptionalItems(obj.items);

  return {
    shopName: obj.shopName,
    date: obj.date,
    amountYen: obj.amountYen,
    documentType,
    paymentPlace,
    payeeName,
    paymentPurpose,
    categoryName,
    items,
    confidence,
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings as string[]).filter((w) => typeof w === "string")
      : [],
  };
}

function parseOptionalItems(value: unknown): ExtractReceiptItemResult[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ConvexError("OpenAI レスポンスの items が配列ではありません");
  }
  if (value.length > MAX_EXTRACTED_LINE_ITEMS) {
    throw new ConvexError(
      `OpenAI レスポンスの items は ${MAX_EXTRACTED_LINE_ITEMS} 件以下である必要があります`,
    );
  }
  return value.map((rawItem, index) => parseReceiptItem(rawItem, index));
}

function parseReceiptItem(value: unknown, index: number): ExtractReceiptItemResult {
  if (typeof value !== "object" || value === null) {
    throw new ConvexError(`OpenAI レスポンスの items[${index}] がオブジェクトではありません`);
  }
  const item = value as Record<string, unknown>;
  if (typeof item.itemName !== "string") {
    throw new ConvexError(`OpenAI レスポンスの items[${index}].itemName が文字列ではありません`);
  }
  if (typeof item.amountYen !== "number") {
    throw new ConvexError(`OpenAI レスポンスの items[${index}].amountYen が数値ではありません`);
  }
  if (
    !Number.isInteger(item.amountYen) ||
    (item.amountYen < 0 && !isDiscountItemName(item.itemName))
  ) {
    throw new ConvexError(
      `OpenAI レスポンスの items[${index}].amountYen は通常明細では0以上、割引明細では負の整数である必要があります`,
    );
  }

  const confidence = parseItemConfidence(item.confidence, index);
  return {
    itemName: item.itemName,
    amountYen: item.amountYen,
    categoryName: parseOptionalString(item.categoryName, `items[${index}].categoryName`),
    confidence,
    warnings: Array.isArray(item.warnings)
      ? (item.warnings as string[]).filter((warning) => typeof warning === "string")
      : [],
  };
}

function parseItemConfidence(
  value: unknown,
  index: number,
): ExtractReceiptItemResult["confidence"] {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object") {
    throw new ConvexError(
      `OpenAI レスポンスの items[${index}].confidence がオブジェクトではありません`,
    );
  }
  const confidence = value as Record<string, unknown>;
  return {
    itemName: parseOptionalConfidenceScore(confidence.itemName, `items[${index}].itemName`),
    amountYen: parseOptionalConfidenceScore(confidence.amountYen, `items[${index}].amountYen`),
    categoryName: parseOptionalConfidenceScore(
      confidence.categoryName,
      `items[${index}].categoryName`,
    ),
  };
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ConvexError(`OpenAI レスポンスの ${fieldName} が文字列ではありません`);
  }
  return value;
}

function parseOptionalDocumentType(value: unknown): "receipt" | "convenience_payment" | "unknown" {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (value !== "receipt" && value !== "convenience_payment" && value !== "unknown") {
    throw new ConvexError(
      'OpenAI レスポンスの documentType は "receipt", "convenience_payment", "unknown" のいずれかである必要があります',
    );
  }
  return value;
}

function parseConfidence(value: unknown): ExtractionConfidence {
  if (typeof value !== "object" || value === null) {
    throw new ConvexError("OpenAI レスポンスの confidence がオブジェクトではありません");
  }
  const confidence = value as Record<string, unknown>;
  const shopName = parseConfidenceScore(confidence.shopName, "shopName");
  const date = parseConfidenceScore(confidence.date, "date");
  const amountYen = parseConfidenceScore(confidence.amountYen, "amountYen");
  return {
    shopName,
    date,
    amountYen,
    documentType: parseOptionalConfidenceScore(confidence.documentType, "documentType"),
    paymentPlace: parseOptionalConfidenceScore(confidence.paymentPlace, "paymentPlace"),
    payeeName: parseOptionalConfidenceScore(confidence.payeeName, "payeeName"),
    paymentPurpose: parseOptionalConfidenceScore(confidence.paymentPurpose, "paymentPurpose"),
    categoryName: parseOptionalConfidenceScore(confidence.categoryName, "categoryName"),
  };
}

function parseConfidenceScore(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new ConvexError(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

function parseOptionalConfidenceScore(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new ConvexError(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

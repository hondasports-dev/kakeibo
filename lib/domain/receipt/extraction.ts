import { isDiscountItemName } from "./discountItems";
import {
  validateExtractedIsoDate,
  validateReceiptShopName,
  validateReceiptTotalAmount,
} from "./receiptExtraction";
import type {
  AmountBasis,
  ExtractedFields,
  ExtractedTaxSummary,
  ExtractionConfidence,
  ExtractReceiptItemResult,
  OpenAIResponsesApiResponse,
  ReceiptItemTaxRatePercent,
  ReceiptMarkerDefinition,
  RoundingMethod,
  TaxMode,
  TaxRatePercent,
} from "../../convex/receiptImageExtraction/types";

export { JAPAN_TIME_ZONE } from "../common/date";
export const MAX_EXTRACTED_LINE_ITEMS = 100;

export type ParseOpenAIResponseResult =
  | { success: true; extracted: ExtractedFields }
  | { success: false; error: string };

/** OpenAI Responses API のレスポンスから抽出結果を取り出す */
export function parseOpenAIResponse(data: OpenAIResponsesApiResponse): ParseOpenAIResponseResult {
  try {
    const message = data.output?.find((o) => o.type === "message");
    const textContent = message?.content?.find((c) => c.type === "output_text");
    if (!textContent?.text) {
      throw new Error("OpenAI からのレスポンスに期待するテキストコンテンツが含まれていません");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      throw new Error("OpenAI からのレスポンスを JSON としてパースできませんでした");
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("OpenAI レスポンスが期待する形式ではありません");
    }
    const obj = parsed as Record<string, unknown>;

    if (typeof obj.shopName !== "string") {
      throw new Error("OpenAI レスポンスの shopName が文字列ではありません");
    }
    const shopNameResult = validateReceiptShopName(obj.shopName);
    if (!shopNameResult.success) {
      throw new Error("OpenAI レスポンスの shopName が空または長すぎます");
    }
    if (typeof obj.date !== "string") {
      throw new Error("OpenAI レスポンスの date が文字列ではありません");
    }
    const dateResult = validateExtractedIsoDate(obj.date);
    if (!dateResult.success) {
      throw new Error("OpenAI レスポンスの date が実在する YYYY-MM-DD 形式ではありません");
    }
    if (typeof obj.amountYen !== "number") {
      throw new Error("OpenAI レスポンスの amountYen が数値ではありません");
    }
    const amountResult = validateReceiptTotalAmount(obj.amountYen);
    if (!amountResult.success) {
      throw new Error(
        "OpenAI レスポンスの amountYen は 1 円以上 9,999,999 円以下の整数である必要があります",
      );
    }
    const confidence = parseConfidence(obj.confidence);

    const documentType = parseOptionalDocumentType(obj.documentType);
    const paymentPlace = parseOptionalString(obj.paymentPlace, "paymentPlace");
    const payeeName = parseOptionalString(obj.payeeName, "payeeName");
    const paymentPurpose = parseOptionalString(obj.paymentPurpose, "paymentPurpose");
    const categoryName = parseOptionalString(obj.categoryName, "categoryName");
    const items = parseOptionalItems(obj.items);
    const taxSummaries = parseOptionalTaxSummaries(obj.taxSummaries);
    const markerDefinitions = parseOptionalMarkerDefinitions(obj.markerDefinitions);

    return {
      success: true,
      extracted: {
        shopName: obj.shopName,
        date: obj.date,
        amountYen: obj.amountYen,
        documentType,
        paymentPlace,
        payeeName,
        paymentPurpose,
        categoryName,
        items,
        taxSummaries,
        markerDefinitions,
        confidence,
        warnings: Array.isArray(obj.warnings)
          ? (obj.warnings as string[]).filter((w) => typeof w === "string")
          : [],
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function parseOptionalItems(value: unknown): ExtractReceiptItemResult[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("OpenAI レスポンスの items が配列ではありません");
  }
  if (value.length > MAX_EXTRACTED_LINE_ITEMS) {
    throw new Error(
      `OpenAI レスポンスの items は ${MAX_EXTRACTED_LINE_ITEMS} 件以下である必要があります`,
    );
  }
  return value.map((rawItem, index) => parseReceiptItem(rawItem, index));
}

function parseReceiptItem(value: unknown, index: number): ExtractReceiptItemResult {
  if (typeof value !== "object" || value === null) {
    throw new Error(`OpenAI レスポンスの items[${index}] がオブジェクトではありません`);
  }
  const item = value as Record<string, unknown>;
  if (typeof item.itemName !== "string") {
    throw new Error(`OpenAI レスポンスの items[${index}].itemName が文字列ではありません`);
  }
  const printedAmountYen = parseSignedItemInteger(
    item.printedAmountYen,
    `items[${index}].printedAmountYen`,
    item.itemName,
  );
  const amountBasis = parseAmountBasis(item.amountBasis, `items[${index}].amountBasis`);
  const taxRatePercent = parseItemTaxRatePercent(
    item.taxRatePercent,
    `items[${index}].taxRatePercent`,
  );
  const markers = parseStringArray(item.markers, `items[${index}].markers`);
  const taxMarker = parseOptionalString(item.taxMarker, `items[${index}].taxMarker`);

  const confidence = parseItemConfidence(item.confidence, index);
  return {
    itemName: item.itemName,
    amountYen: printedAmountYen,
    printedAmountYen,
    amountBasis,
    taxRatePercent,
    markers: markers ?? (taxMarker ? [taxMarker] : []),
    taxMarker: taxMarker ?? markers?.[0] ?? "",
    quantity: parseOptionalInteger(item.quantity, `items[${index}].quantity`),
    unitPriceYen: parseOptionalInteger(item.unitPriceYen, `items[${index}].unitPriceYen`),
    categoryName: parseOptionalString(item.categoryName, `items[${index}].categoryName`),
    confidence,
    warnings: Array.isArray(item.warnings)
      ? (item.warnings as string[]).filter((warning) => typeof warning === "string")
      : [],
  };
}

function parseOptionalMarkerDefinitions(value: unknown): ReceiptMarkerDefinition[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("OpenAI レスポンスの markerDefinitions が配列ではありません");
  }
  return value.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`OpenAI レスポンスの markerDefinitions[${index}] が不正です`);
    }
    const definition = raw as Record<string, unknown>;
    if (typeof definition.marker !== "string" || typeof definition.description !== "string") {
      throw new Error(`OpenAI レスポンスの markerDefinitions[${index}] が不正です`);
    }
    return { marker: definition.marker, description: definition.description };
  });
}

function parseStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`OpenAI レスポンスの ${field} が文字列配列ではありません`);
  }
  return [...new Set(value)];
}

function parseItemConfidence(
  value: unknown,
  index: number,
): ExtractReceiptItemResult["confidence"] {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object") {
    throw new Error(`OpenAI レスポンスの items[${index}].confidence がオブジェクトではありません`);
  }
  const confidence = value as Record<string, unknown>;
  return {
    itemName: parseOptionalConfidenceScore(confidence.itemName, `items[${index}].itemName`),
    // amountYen は後方互換フィールドのため、印字額の信頼度を意図的に引き継ぐ。
    amountYen: parseOptionalConfidenceScore(
      confidence.printedAmountYen,
      `items[${index}].printedAmountYen`,
    ),
    printedAmountYen: parseOptionalConfidenceScore(
      confidence.printedAmountYen,
      `items[${index}].printedAmountYen`,
    ),
    amountBasis: parseOptionalConfidenceScore(
      confidence.amountBasis,
      `items[${index}].amountBasis`,
    ),
    taxRatePercent: parseOptionalConfidenceScore(
      confidence.taxRatePercent,
      `items[${index}].taxRatePercent`,
    ),
    categoryName: parseOptionalConfidenceScore(
      confidence.categoryName,
      `items[${index}].categoryName`,
    ),
  };
}

function parseOptionalTaxSummaries(value: unknown): ExtractedTaxSummary[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("OpenAI レスポンスの taxSummaries が配列ではありません");
  }
  return value.map((summary, index) => parseTaxSummary(summary, index));
}

function parseTaxSummary(value: unknown, index: number): ExtractedTaxSummary {
  const field = `taxSummaries[${index}]`;
  if (typeof value !== "object" || value === null) {
    throw new Error(`OpenAI レスポンスの ${field} がオブジェクトではありません`);
  }
  const summary = value as Record<string, unknown>;
  const confidence = parseTaxSummaryConfidence(summary.confidence, field);
  return {
    taxRatePercent: parseTaxRatePercent(summary.taxRatePercent, `${field}.taxRatePercent`),
    taxMode: parseTaxMode(summary.taxMode, `${field}.taxMode`),
    taxableAmountYen: parseNonNegativeInteger(
      summary.taxableAmountYen,
      `${field}.taxableAmountYen`,
    ),
    taxableAmountBasis: parseAmountBasis(summary.taxableAmountBasis, `${field}.taxableAmountBasis`),
    taxYen: parseNonNegativeInteger(summary.taxYen, `${field}.taxYen`),
    taxIncludedAmountYen: parseOptionalNonNegativeInteger(
      summary.taxIncludedAmountYen,
      `${field}.taxIncludedAmountYen`,
    ),
    roundingMethod: parseRoundingMethod(summary.roundingMethod, `${field}.roundingMethod`),
    confidence,
    warnings: Array.isArray(summary.warnings)
      ? summary.warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
  };
}

function parseTaxSummaryConfidence(
  value: unknown,
  field: string,
): ExtractedTaxSummary["confidence"] {
  if (typeof value !== "object" || value === null) {
    throw new Error(`OpenAI レスポンスの ${field}.confidence がオブジェクトではありません`);
  }
  const confidence = value as Record<string, unknown>;
  return {
    taxRatePercent: parseOptionalConfidenceScore(
      confidence.taxRatePercent,
      `${field}.taxRatePercent`,
    ),
    taxMode: parseOptionalConfidenceScore(confidence.taxMode, `${field}.taxMode`),
    taxableAmountYen: parseOptionalConfidenceScore(
      confidence.taxableAmountYen,
      `${field}.taxableAmountYen`,
    ),
    taxableAmountBasis: parseOptionalConfidenceScore(
      confidence.taxableAmountBasis,
      `${field}.taxableAmountBasis`,
    ),
    taxYen: parseOptionalConfidenceScore(confidence.taxYen, `${field}.taxYen`),
  };
}

function parseTaxRatePercent(value: unknown, field: string): TaxRatePercent {
  if (value === 0 || value === 8 || value === 10) return value;
  throw new Error(`OpenAI レスポンスの ${field} は 0, 8, 10 のいずれかである必要があります`);
}

function parseItemTaxRatePercent(value: unknown, field: string): ReceiptItemTaxRatePercent {
  if (value === null) return null;
  return parseTaxRatePercent(value, field);
}

function parseAmountBasis(value: unknown, field: string): AmountBasis {
  if (value === "tax_included" || value === "tax_excluded" || value === "unknown") return value;
  throw new Error(`OpenAI レスポンスの ${field} が不正です`);
}

function parseTaxMode(value: unknown, field: string): TaxMode {
  if (value === "external" || value === "included" || value === "mixed" || value === "unknown") {
    return value;
  }
  throw new Error(`OpenAI レスポンスの ${field} が不正です`);
}

function parseRoundingMethod(value: unknown, field: string): RoundingMethod {
  if (value === "floor" || value === "round" || value === "ceil" || value === "unknown") {
    return value;
  }
  throw new Error(`OpenAI レスポンスの ${field} が不正です`);
}

function parseNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`OpenAI レスポンスの ${field} は0以上の整数である必要があります`);
  }
  return value;
}

function parseOptionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return parseNonNegativeInteger(value, field);
}

function parseOptionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`OpenAI レスポンスの ${field} は整数である必要があります`);
  }
  return value;
}

function parseSignedItemInteger(value: unknown, field: string, itemName: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    (value < 0 && !isDiscountItemName(itemName))
  ) {
    throw new Error(
      `OpenAI レスポンスの ${field} は通常明細では0以上、割引明細では負の整数である必要があります`,
    );
  }
  return value;
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`OpenAI レスポンスの ${fieldName} が文字列ではありません`);
  }
  return value;
}

function parseOptionalDocumentType(value: unknown): "receipt" | "convenience_payment" | "unknown" {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (value !== "receipt" && value !== "convenience_payment" && value !== "unknown") {
    throw new Error(
      'OpenAI レスポンスの documentType は "receipt", "convenience_payment", "unknown" のいずれかである必要があります',
    );
  }
  return value;
}

function parseConfidence(value: unknown): ExtractionConfidence {
  if (typeof value !== "object" || value === null) {
    throw new Error("OpenAI レスポンスの confidence がオブジェクトではありません");
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
    throw new Error(
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
    throw new Error(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

import type { CategoryLike } from "../categories/candidate";
import type {
  AmountBasis,
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  ReceiptMarkerDefinition,
  ReceiptTaxDecision,
  ReceiptTotalResolution,
  ReceiptTaxInput,
  TaxRatePercent,
  TaxResolutionSource,
} from "../receipt/tax/types";
import type { ExtractReceiptFieldsResult } from "../../convex/receiptImageExtraction/types";
import type {
  ReceiptLineClassification,
  ReceiptRawObservationLine,
  ReceiptStructuralLineRole,
} from "../receipt/observations";
import { classifyReceiptLines, normalizeReceiptLineMatchText } from "../receipt/lineClassification";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "../categories/candidate";
import {
  deriveTaxReviewReasons,
  interpretedItemToDraftFields,
} from "../receipt/tax/draftTaxMapping";
import { interpretReceiptTax } from "../receipt/tax/interpretReceiptTax";
import { interpretReceiptTaxDecision } from "../receipt/tax/interpretReceiptTaxDecision";
import { resolveReceiptTotal } from "../receipt/tax/resolveReceiptTotal";
import type {
  AiExpenseDraftConfidence,
  AiExpenseDraftDocumentType,
  AiExpenseDraftReviewReason,
} from "./constants";

export type DraftItem<TId = string> = {
  itemName: string;
  amountYen: number;
  printedAmountYen?: number;
  amountBasis?: AmountBasis;
  taxRatePercent?: TaxRatePercent | null;
  markers?: string[];
  taxMarker?: string;
  allocatedTaxYen?: number;
  normalizedAmountYen?: number;
  taxResolutionStatus?: "resolved" | "unresolved";
  taxResolutionSource?: TaxResolutionSource;
  taxReviewReasons?: string[];
  quantity?: number;
  unitPriceYen?: number;
  categoryName?: string;
  categoryId?: TId;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
  warnings?: string[];
};

export type DraftArgs<TId = string> = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  taxSummaries?: ExtractedTaxSummary[];
  receiptTotalResolution?: ReceiptTotalResolution;
  receiptTaxDecision?: ReceiptTaxDecision;
  rawObservationLines?: ReceiptRawObservationLine[];
  receiptLineClassifications?: ReceiptLineClassification[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  categoryId?: TId;
  imageFileName?: string;
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  reviewReasons?: AiExpenseDraftReviewReason[];
  items?: DraftItem<TId>[];
};

const STRUCTURAL_NON_ITEM_ROLES = new Set<ReceiptStructuralLineRole>([
  "tax",
  "subtotal",
  "totalCandidate",
  "paymentMethodAmount",
  "cashReceived",
  "change",
  "unknown",
]);

function receiptTaxAmounts(taxSummaries: ExtractedTaxSummary[]) {
  return [
    ...taxSummaries.flatMap((summary) => [
      summary.taxYen,
      summary.taxableAmountYen,
      ...(summary.taxIncludedAmountYen === undefined ? [] : [summary.taxIncludedAmountYen]),
    ]),
    taxSummaries.reduce((sum, summary) => sum + summary.taxYen, 0),
  ];
}

function classificationForExtractedItem(
  item: NonNullable<ExtractReceiptFieldsResult["items"]>[number],
  rawLines: ReceiptRawObservationLine[],
  classifications: ReceiptLineClassification[],
) {
  const itemText = normalizeReceiptLineMatchText(item.itemName);
  const printedAmountYen = item.printedAmountYen ?? item.amountYen;
  return classifications
    .flatMap((classification) => {
      const line = rawLines.find(
        (candidate) => candidate.sourceLineIndex === classification.sourceLineIndex,
      );
      if (!line) return [];
      const lineText = normalizeReceiptLineMatchText(line.rawText);
      const textMatches =
        itemText.length > 0 &&
        lineText.length > 0 &&
        (lineText.includes(itemText) || itemText.includes(lineText));
      return textMatches
        ? [{ classification, amountMatches: line.amountYen === printedAmountYen }]
        : [];
    })
    .sort((left, right) => Number(right.amountMatches) - Number(left.amountMatches))[0]
    ?.classification;
}

function normalizeExtractedItemForTax(
  item: NonNullable<ExtractReceiptFieldsResult["items"]>[number],
): ExtractedReceiptItem {
  return {
    itemName: item.itemName,
    printedAmountYen: item.printedAmountYen ?? item.amountYen,
    taxRatePercent: item.taxRatePercent ?? null,
    amountBasis: item.amountBasis ?? "unknown",
    markers: item.markers ?? (item.taxMarker ? [item.taxMarker] : []),
    taxMarker: item.taxMarker,
    categoryName: item.categoryName,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    warnings: item.warnings,
  };
}

export function mapExtractionToDraftArgs<TId>(
  extracted: ExtractReceiptFieldsResult,
  categories: CategoryLike<TId>[],
  imageFileName?: string,
): DraftArgs<TId> {
  const rawObservationLines = extracted.rawObservations ?? [];
  const receiptLineClassifications = classifyReceiptLines(rawObservationLines, {
    receiptTotalYen: extracted.amountYen,
    taxAmountsYen: receiptTaxAmounts((extracted.taxSummaries ?? []) as ExtractedTaxSummary[]),
  });
  const ambiguousExtractedItemIndexes: number[] = [];
  const extractedItems = extracted.items?.filter((item, index) => {
    const fromRaw = classificationForExtractedItem(
      item,
      rawObservationLines,
      receiptLineClassifications,
    );
    const [fallback] = classifyReceiptLines(
      [
        {
          rawText: item.itemName,
          amountText: String(item.printedAmountYen ?? item.amountYen),
          amountYen: item.printedAmountYen ?? item.amountYen,
          lineRoleCandidates: ["item"],
          roleConfidence: item.confidence.itemName ?? 0.5,
          explicitlyPrinted: true,
          sourceLineIndex: 0,
        },
      ],
      { taxAmountsYen: receiptTaxAmounts((extracted.taxSummaries ?? []) as ExtractedTaxSummary[]) },
    );
    const classification = fromRaw ?? fallback;
    if (classification?.status === "ambiguous") {
      ambiguousExtractedItemIndexes.push(index);
      return false;
    }
    const role = classification?.candidates[0]?.role ?? "unknown";
    return !STRUCTURAL_NON_ITEM_ROLES.has(role);
  });

  const candidates = buildCategoryCandidates({
    documentType: extracted.documentType,
    categoryName: extracted.categoryName,
    shopName: extracted.shopName || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    categories,
  });
  const categoryId = resolveCategoryIdFromCandidates(extracted.categoryName, candidates);

  const taxInput: ReceiptTaxInput | undefined =
    extracted.amountYen !== null && extracted.taxSummaries
      ? {
          amountYen: extracted.amountYen,
          receiptTotalSource: "explicit_label",
          receiptTotalConfidence: extracted.confidence.amountYen,
          items: (extractedItems ?? []).map(normalizeExtractedItemForTax),
          taxSummaries: extracted.taxSummaries as ExtractedTaxSummary[],
          markerDefinitions: extracted.markerDefinitions,
          rawObservationLines,
          receiptLineClassifications,
        }
      : undefined;

  const interpretation =
    taxInput && taxInput.items.length > 0 ? interpretReceiptTax(taxInput) : undefined;
  const receiptTaxDecision = taxInput
    ? (interpretation?.decision ?? interpretReceiptTaxDecision(taxInput))
    : undefined;
  const receiptTotalResolution =
    interpretation?.receiptTotalResolution ??
    resolveReceiptTotal({
      amountYen: extracted.amountYen,
      source: "explicit_label",
      confidence: extracted.confidence.amountYen,
      taxSummaries: (extracted.taxSummaries ?? []) as ExtractedTaxSummary[],
    });

  const items = extractedItems?.map((item, index) => {
    const normalized = interpretation?.items[index];
    const itemCandidates = buildCategoryCandidates({
      documentType: extracted.documentType,
      categoryName: item.categoryName,
      shopName: item.itemName,
      categories,
    });
    const itemCategoryId = resolveCategoryIdFromCandidates(item.categoryName, itemCandidates);
    const taxFields = normalized ? interpretedItemToDraftFields(normalized) : undefined;

    return {
      itemName: item.itemName,
      amountYen: normalized?.normalizedAmountYen ?? item.amountYen,
      printedAmountYen: taxFields?.printedAmountYen ?? item.printedAmountYen,
      amountBasis: taxFields?.amountBasis ?? item.amountBasis,
      taxRatePercent:
        taxFields?.taxResolutionStatus === "unresolved"
          ? null
          : taxFields !== undefined
            ? (taxFields.taxRatePercent ?? null)
            : item.taxRatePercent,
      markers: normalized?.markers ?? item.markers,
      taxMarker: normalized?.taxMarker ?? item.taxMarker,
      allocatedTaxYen: taxFields?.allocatedTaxYen,
      normalizedAmountYen: taxFields?.normalizedAmountYen,
      taxResolutionStatus: taxFields?.taxResolutionStatus,
      taxResolutionSource: taxFields?.taxResolutionSource,
      taxReviewReasons: taxFields?.taxReviewReasons,
      quantity: normalized?.quantity ?? item.quantity,
      unitPriceYen: normalized?.unitPriceYen ?? item.unitPriceYen,
      categoryName: item.categoryName,
      categoryId: itemCategoryId,
      confidence: {
        itemName: item.confidence.itemName,
        amountYen: item.confidence.amountYen,
        categoryName: item.confidence.categoryName,
        categoryId: item.confidence.categoryName,
      },
      warnings: taxFields?.warnings ?? item.warnings,
    };
  });

  const taxReviewReasons = deriveTaxReviewReasons(interpretation);
  const ambiguousStructuralLines = receiptLineClassifications.filter(
    (classification) =>
      classification.status === "ambiguous" &&
      rawObservationLines.some(
        (line) =>
          line.sourceLineIndex === classification.sourceLineIndex && line.amountYen !== null,
      ),
  );
  const reviewReasons = [
    ...taxReviewReasons,
    ...(ambiguousStructuralLines.length > 0 || ambiguousExtractedItemIndexes.length > 0
      ? (["user_confirmation_required"] as const)
      : []),
  ];

  return {
    documentType: extracted.documentType,
    shopName: extracted.shopName || undefined,
    paymentPlace: extracted.paymentPlace || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    date: extracted.date || undefined,
    amountYen:
      extracted.amountYen !== null && extracted.amountYen > 0 ? extracted.amountYen : undefined,
    taxSummaries: interpretation?.taxSummaries ?? extracted.taxSummaries,
    receiptTotalResolution,
    receiptTaxDecision,
    rawObservationLines: extracted.rawObservations,
    receiptLineClassifications,
    markerDefinitions: extracted.markerDefinitions,
    categoryId,
    imageFileName,
    confidence: {
      documentType: extracted.confidence.documentType,
      shopName: extracted.confidence.shopName,
      paymentPlace: extracted.confidence.paymentPlace,
      payeeName: extracted.confidence.payeeName,
      paymentPurpose: extracted.confidence.paymentPurpose,
      date: extracted.confidence.date,
      amountYen: extracted.confidence.amountYen,
      categoryId: extracted.confidence.categoryName,
    },
    warnings: [
      ...new Set([
        ...extracted.warnings,
        ...(interpretation?.warnings ?? []),
        ...ambiguousStructuralLines.map(
          (classification) => `ambiguous_receipt_line:${classification.sourceLineIndex}`,
        ),
        ...ambiguousExtractedItemIndexes.map((index) => `ambiguous_extracted_item:${index}`),
      ]),
    ],
    reviewReasons: reviewReasons.length > 0 ? [...new Set(reviewReasons)] : undefined,
    items,
  };
}

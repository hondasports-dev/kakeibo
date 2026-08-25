import type { CategoryLike } from "../categories/candidate";
import type {
  AmountBasis,
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  ReceiptMarkerDefinition,
  ReceiptTotalResolution,
  ReceiptTaxInput,
  TaxRatePercent,
  TaxResolutionSource,
} from "../receipt/tax/types";
import type { ExtractReceiptFieldsResult } from "../../convex/receiptImageExtraction/types";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "../categories/candidate";
import {
  deriveTaxReviewReasons,
  interpretedItemToDraftFields,
} from "../receipt/tax/draftTaxMapping";
import { interpretReceiptTax } from "../receipt/tax/interpretReceiptTax";
import { resolveReceiptTotal } from "../receipt/tax/resolveReceiptTotal";
import { isTaxSummaryItem } from "./extraction";
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
  markerDefinitions?: ReceiptMarkerDefinition[];
  categoryId?: TId;
  imageFileName?: string;
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  reviewReasons?: AiExpenseDraftReviewReason[];
  items?: DraftItem<TId>[];
};

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
  const extractedItems = extracted.items?.filter(
    (item) => !isTaxSummaryItem(item, extracted.taxSummaries ?? []),
  );

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
    extractedItems && extractedItems.length > 0 && extracted.taxSummaries
      ? {
          amountYen: extracted.amountYen,
          receiptTotalSource: "explicit_label",
          receiptTotalConfidence: extracted.confidence.amountYen,
          items: extractedItems.map(normalizeExtractedItemForTax),
          taxSummaries: extracted.taxSummaries as ExtractedTaxSummary[],
          markerDefinitions: extracted.markerDefinitions,
        }
      : undefined;

  const interpretation = taxInput ? interpretReceiptTax(taxInput) : undefined;
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

  return {
    documentType: extracted.documentType,
    shopName: extracted.shopName || undefined,
    paymentPlace: extracted.paymentPlace || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    date: extracted.date || undefined,
    amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
    taxSummaries: interpretation?.taxSummaries ?? extracted.taxSummaries,
    receiptTotalResolution,
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
    warnings: [...new Set([...extracted.warnings, ...(interpretation?.warnings ?? [])])],
    reviewReasons: taxReviewReasons.length > 0 ? taxReviewReasons : undefined,
    items,
  };
}

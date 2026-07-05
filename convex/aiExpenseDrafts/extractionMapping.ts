import type { Doc } from "../_generated/dataModel";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "../categories/candidate";
import type { ExtractReceiptFieldsResult } from "../receiptImageExtraction/extraction";
import type { CreateFromExtractionArgs } from "./internal";
import { interpretReceiptTax } from "../../lib/receiptTax";
import {
  deriveTaxReviewReasons,
  interpretedItemToDraftFields,
} from "../../lib/receiptTax/draftTaxMapping";

type ExtractedItem = NonNullable<ExtractReceiptFieldsResult["items"]>[number];
type ExtractedTaxSummaries = NonNullable<ExtractReceiptFieldsResult["taxSummaries"]>;

const TAX_SUMMARY_ITEM_NAME_PATTERN =
  /(?:消費税(?:等|計)?|税合計|(?:[0-9０-９]+\s*[%％]|[（(])[^）)]*(?:内税|外税)|(?:内税|外税)(?:額|計|対象|タイショウ|$))/;

function isTaxSummaryItem(item: ExtractedItem, taxSummaries: ExtractedTaxSummaries): boolean {
  const printedAmountYen = item.printedAmountYen ?? item.amountYen;
  if (printedAmountYen <= 0 || !TAX_SUMMARY_ITEM_NAME_PATTERN.test(item.itemName)) {
    return false;
  }
  const taxAmounts = new Set(
    taxSummaries.flatMap((summary) => [
      summary.taxYen,
      summary.taxableAmountYen,
      ...(summary.taxIncludedAmountYen === undefined ? [] : [summary.taxIncludedAmountYen]),
    ]),
  );
  taxAmounts.add(taxSummaries.reduce((sum, summary) => sum + summary.taxYen, 0));
  return taxAmounts.has(printedAmountYen);
}

export function mapExtractionToDraftArgs(
  extracted: ExtractReceiptFieldsResult,
  categories: Doc<"categories">[],
  imageFileName?: string,
): CreateFromExtractionArgs {
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
  const interpretation =
    extractedItems && extractedItems.length > 0 && extracted.taxSummaries
      ? interpretReceiptTax({
          amountYen: extracted.amountYen,
          items: extractedItems.map((item) => ({
            itemName: item.itemName,
            printedAmountYen: item.printedAmountYen ?? item.amountYen,
            amountBasis: item.amountBasis ?? "unknown",
            taxRatePercent: item.taxRatePercent ?? null,
            markers: item.markers ?? (item.taxMarker ? [item.taxMarker] : []),
            taxMarker: item.taxMarker ?? "",
            categoryName: item.categoryName,
            quantity: item.quantity,
            unitPriceYen: item.unitPriceYen,
            warnings: item.warnings,
          })),
          taxSummaries: extracted.taxSummaries,
          markerDefinitions: extracted.markerDefinitions,
        })
      : undefined;
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

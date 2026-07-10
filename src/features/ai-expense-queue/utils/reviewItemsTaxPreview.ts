import { reinterpretDraftTax } from "../../../../lib/receiptTax/reinterpretDraftTax";
import type { DraftItemTaxFields } from "../../../../lib/receiptTax/draftTaxMapping";
import type { ExtractedTaxSummary } from "../../../../lib/receiptTax/types";
import type { AiExpenseDraft, ReviewItemValues } from "../types/types";

function toExtractedTaxSummaries(
  taxSummaries: NonNullable<AiExpenseDraft["taxSummaries"]>,
): ExtractedTaxSummary[] {
  return taxSummaries.map((summary) => ({
    ...summary,
    confidence: {},
  }));
}

function reviewItemToDraftFields(item: ReviewItemValues): DraftItemTaxFields {
  const printedAmountYen =
    item.printedAmountYen ??
    (Number.isFinite(Number(item.amountYen)) ? Number(item.amountYen) : undefined);

  return {
    itemName: item.itemName,
    printedAmountYen,
    amountBasis: item.amountBasis,
    taxRatePercent: item.taxRatePercent,
    markers: item.markers,
    taxMarker: item.taxMarker,
    allocatedTaxYen: item.allocatedTaxYen,
    normalizedAmountYen: item.normalizedAmountYen,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    warnings: item.warnings,
    taxResolutionStatus: item.taxResolutionStatus,
    taxResolutionSource: item.taxResolutionSource,
    taxReviewReasons: item.taxReviewReasons,
  };
}

export function applyReviewItemsTaxPreview(
  items: ReviewItemValues[],
  args: {
    paidTotalYen?: number;
    taxSummaries?: AiExpenseDraft["taxSummaries"];
    markerDefinitions?: AiExpenseDraft["markerDefinitions"];
  },
): ReviewItemValues[] {
  const paidTotalYen = args.paidTotalYen;
  if (paidTotalYen === undefined || !Number.isFinite(paidTotalYen) || paidTotalYen < 1) {
    return items;
  }
  if (!args.taxSummaries || args.taxSummaries.length === 0) {
    return items;
  }
  if (!items.some((item) => item.taxResolutionStatus === "resolved")) {
    return items;
  }

  const { itemFields } = reinterpretDraftTax({
    amountYen: paidTotalYen,
    items: items.map(reviewItemToDraftFields),
    taxSummaries: toExtractedTaxSummaries(args.taxSummaries),
    markerDefinitions: args.markerDefinitions,
  });

  return items.map((item, index) => {
    const fields = itemFields[index];
    if (!fields) {
      return item;
    }
    return {
      ...item,
      printedAmountYen: fields.printedAmountYen,
      amountBasis: fields.amountBasis,
      taxRatePercent: fields.taxRatePercent,
      allocatedTaxYen: fields.allocatedTaxYen,
      normalizedAmountYen: fields.normalizedAmountYen,
      taxResolutionStatus: fields.taxResolutionStatus,
      taxResolutionSource: fields.taxResolutionSource,
      taxReviewReasons: fields.taxReviewReasons,
      warnings: fields.warnings,
    };
  });
}

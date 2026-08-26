import {
  draftItemToExtractedReceiptItem,
  interpretedItemToDraftFields,
  type DraftItemTaxFields,
} from "./draftTaxMapping";
import { interpretReceiptTax } from "./interpretReceiptTax";
import type {
  AmountBasis,
  DraftSummaryOverride,
  ExtractedTaxSummary,
  ReceiptMarkerDefinition,
  ReceiptTaxInput,
  ReceiptTaxInterpretation,
  PriceTaxTreatment,
  TaxRateComposition,
  TaxRatePercent,
} from "./types";
import type { ReceiptLineClassification, ReceiptRawObservationLine } from "../observations";

export type { DraftSummaryOverride } from "./types";

export type DraftTaxOverride = {
  itemIndex: number;
  taxRatePercent?: TaxRatePercent | null;
  amountBasis?: AmountBasis;
};

export type BulkUnresolvedTaxOverride = {
  taxRatePercent: TaxRatePercent;
  amountBasis: AmountBasis;
};

export type ReinterpretDraftTaxInput = {
  amountYen: number;
  receiptTotalSource?: "explicit_label" | "user_confirmed" | "ai_estimate";
  receiptTotalConfidence?: number;
  receiptTotalSupportingCandidates?: ReceiptTaxInput["receiptTotalSupportingCandidates"];
  items: DraftItemTaxFields[];
  taxSummaries: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  rawObservationLines?: ReceiptRawObservationLine[];
  receiptLineClassifications?: ReceiptLineClassification[];
  override?: DraftTaxOverride;
  bulkUnresolvedOverride?: BulkUnresolvedTaxOverride;
  summaryOverride?: DraftSummaryOverride;
};

export type ReinterpretDraftTaxResult = {
  interpretation: ReceiptTaxInterpretation;
  itemFields: ReturnType<typeof interpretedItemToDraftFields>[];
};

function shouldApplyBulkOverride(
  item: DraftItemTaxFields,
  extracted: ReturnType<typeof draftItemToExtractedReceiptItem>,
): boolean {
  if (item.taxResolutionStatus === "resolved") {
    return false;
  }
  if (item.taxResolutionStatus === "unresolved") {
    return true;
  }
  return extracted.amountBasis === "unknown" && extracted.taxRatePercent === null;
}

export function reinterpretDraftTax(input: ReinterpretDraftTaxInput): ReinterpretDraftTaxResult {
  const taxSummaries = input.taxSummaries.map((summary, index) => {
    if (input.summaryOverride?.index === index) {
      return { ...summary, ...input.summaryOverride.summary };
    }
    return summary;
  });

  const items = input.items.map((item, index) => {
    const extracted = draftItemToExtractedReceiptItem(item);
    if (input.override?.itemIndex === index) {
      return {
        ...extracted,
        taxRatePercent:
          input.override.taxRatePercent !== undefined
            ? input.override.taxRatePercent
            : extracted.taxRatePercent,
        amountBasis: input.override.amountBasis ?? extracted.amountBasis,
      };
    }
    if (
      input.bulkUnresolvedOverride &&
      shouldApplyBulkOverride(item, extracted) &&
      input.override?.itemIndex !== index
    ) {
      return {
        ...extracted,
        taxRatePercent: input.bulkUnresolvedOverride.taxRatePercent,
        amountBasis: input.bulkUnresolvedOverride.amountBasis,
      };
    }
    return extracted;
  });

  const userItemPriceWasEdited =
    input.override?.amountBasis !== undefined ||
    input.bulkUnresolvedOverride?.amountBasis !== undefined;
  const userSummaryPriceWasEdited =
    input.summaryOverride?.summary.taxableAmountBasis !== undefined ||
    input.summaryOverride?.summary.taxMode !== undefined;
  const userPriceWasEdited = userItemPriceWasEdited || userSummaryPriceWasEdited;
  const userRateWasEdited =
    input.override?.taxRatePercent !== undefined ||
    input.bulkUnresolvedOverride?.taxRatePercent !== undefined ||
    input.summaryOverride?.summary.taxRatePercent !== undefined;
  const treatmentFromItems = (): PriceTaxTreatment => {
    const bases = new Set(items.map((item) => item.amountBasis));
    if (bases.has("tax_included") && bases.has("tax_excluded")) return "perItem";
    if (bases.has("tax_included")) return "included";
    if (bases.has("tax_excluded")) return "excluded";
    return "unknown";
  };
  const treatmentFromSummaries = (): PriceTaxTreatment => {
    const bases = new Set(
      taxSummaries.map((summary) => {
        if (summary.taxableAmountBasis !== "unknown") return summary.taxableAmountBasis;
        if (summary.taxMode === "included") return "tax_included" as const;
        if (summary.taxMode === "external") return "tax_excluded" as const;
        return "unknown" as const;
      }),
    );
    if (bases.has("tax_included") && bases.has("tax_excluded")) return "perItem";
    if (bases.has("tax_included")) return "included";
    if (bases.has("tax_excluded")) return "excluded";
    return "unknown";
  };
  const compositionFromItemsAndSummaries = (): TaxRateComposition => {
    const rates = new Set([
      ...items.map((item) => item.taxRatePercent),
      ...taxSummaries.map((summary) => summary.taxRatePercent),
    ]);
    if (rates.has(8) && rates.has(10)) return "mixed";
    if (rates.has(8)) return "rate8";
    if (rates.has(10)) return "rate10";
    return "unknown";
  };

  const interpretation = interpretReceiptTax({
    amountYen: input.amountYen,
    receiptTotalSource: input.receiptTotalSource,
    receiptTotalConfidence: input.receiptTotalConfidence,
    receiptTotalSupportingCandidates: input.receiptTotalSupportingCandidates,
    items,
    taxSummaries,
    markerDefinitions: input.markerDefinitions,
    rawObservationLines: input.rawObservationLines,
    receiptLineClassifications: input.receiptLineClassifications,
    userOverride:
      userPriceWasEdited || userRateWasEdited
        ? {
            priceTaxTreatment: userPriceWasEdited
              ? userItemPriceWasEdited
                ? treatmentFromItems()
                : treatmentFromSummaries()
              : undefined,
            taxRateComposition: userRateWasEdited ? compositionFromItemsAndSummaries() : undefined,
          }
        : undefined,
  });

  return {
    interpretation,
    itemFields: interpretation.items.map(interpretedItemToDraftFields),
  };
}

export function resolveAmountBasisFromSummary(summary: ExtractedTaxSummary): AmountBasis | null {
  if (summary.taxableAmountBasis === "tax_included") {
    return "tax_included";
  }
  if (summary.taxableAmountBasis === "tax_excluded") {
    return "tax_excluded";
  }
  if (summary.taxMode === "external") {
    return "tax_excluded";
  }
  if (summary.taxMode === "included") {
    return "tax_included";
  }
  return null;
}

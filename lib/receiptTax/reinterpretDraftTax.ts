import {
  draftItemToExtractedReceiptItem,
  interpretedItemToDraftFields,
  type DraftItemTaxFields,
} from "./draftTaxMapping";
import { interpretReceiptTax } from "./interpretReceiptTax";
import type {
  AmountBasis,
  ExtractedTaxSummary,
  ReceiptMarkerDefinition,
  ReceiptTaxInterpretation,
  TaxRatePercent,
} from "./types";

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
  items: DraftItemTaxFields[];
  taxSummaries: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  override?: DraftTaxOverride;
  bulkUnresolvedOverride?: BulkUnresolvedTaxOverride;
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
  return extracted.amountBasis === "unknown" || extracted.taxRatePercent === null;
}

export function reinterpretDraftTax(input: ReinterpretDraftTaxInput): ReinterpretDraftTaxResult {
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

  const interpretation = interpretReceiptTax({
    amountYen: input.amountYen,
    items,
    taxSummaries: input.taxSummaries,
    markerDefinitions: input.markerDefinitions,
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

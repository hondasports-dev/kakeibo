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

export type ReinterpretDraftTaxInput = {
  amountYen: number;
  items: DraftItemTaxFields[];
  taxSummaries: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  override?: DraftTaxOverride;
};

export type ReinterpretDraftTaxResult = {
  interpretation: ReceiptTaxInterpretation;
  itemFields: ReturnType<typeof interpretedItemToDraftFields>[];
};

export function reinterpretDraftTax(input: ReinterpretDraftTaxInput): ReinterpretDraftTaxResult {
  const items = input.items.map((item, index) => {
    const extracted = draftItemToExtractedReceiptItem(item);
    if (input.override?.itemIndex !== index) {
      return extracted;
    }
    return {
      ...extracted,
      taxRatePercent:
        input.override.taxRatePercent !== undefined
          ? input.override.taxRatePercent
          : extracted.taxRatePercent,
      amountBasis: input.override.amountBasis ?? extracted.amountBasis,
    };
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

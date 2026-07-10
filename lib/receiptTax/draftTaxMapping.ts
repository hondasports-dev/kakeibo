import type { AiExpenseDraftReviewReason } from "../../convex/aiExpenseDrafts/model";
import type {
  AmountBasis,
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  InterpretedReceiptItem,
  ReceiptMarkerDefinition,
  ReceiptTaxInput,
  ReceiptTaxInterpretation,
  TaxContextResolution,
  TaxRatePercent,
  TaxResolutionSource,
} from "./types";

export type DraftItemTaxFields = {
  itemName: string;
  printedAmountYen?: number;
  amountBasis?: AmountBasis;
  taxRatePercent?: TaxRatePercent | null;
  markers?: string[];
  taxMarker?: string;
  allocatedTaxYen?: number;
  normalizedAmountYen?: number;
  quantity?: number;
  unitPriceYen?: number;
  categoryName?: string;
  warnings?: string[];
  taxResolutionStatus?: "resolved" | "unresolved";
  taxResolutionSource?: TaxResolutionSource;
  taxReviewReasons?: string[];
};

export function taxContextToDraftFields(taxContext: TaxContextResolution): {
  taxResolutionStatus: "resolved" | "unresolved";
  taxResolutionSource?: TaxResolutionSource;
  taxReviewReasons?: string[];
  taxRatePercent: TaxRatePercent | null;
  amountBasis: AmountBasis;
} {
  if (taxContext.status === "resolved") {
    return {
      taxResolutionStatus: "resolved",
      taxResolutionSource: taxContext.source,
      taxRatePercent: taxContext.taxRatePercent,
      amountBasis: taxContext.amountBasis,
    };
  }
  return {
    taxResolutionStatus: "unresolved",
    taxReviewReasons: taxContext.reasons,
    taxRatePercent: taxContext.taxRatePercent,
    amountBasis: taxContext.amountBasis,
  };
}

export function interpretedItemToDraftFields(item: InterpretedReceiptItem) {
  const taxFields = taxContextToDraftFields(item.taxContext);
  return {
    printedAmountYen: item.printedAmountYen,
    amountBasis: taxFields.amountBasis,
    taxRatePercent: taxFields.taxRatePercent,
    markers: item.markers,
    taxMarker: item.taxMarker,
    allocatedTaxYen: item.allocatedTaxYen,
    normalizedAmountYen: item.normalizedAmountYen,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    warnings: item.warnings,
    taxResolutionStatus: taxFields.taxResolutionStatus,
    taxResolutionSource: taxFields.taxResolutionSource,
    taxReviewReasons: taxFields.taxReviewReasons,
  };
}

export function isTaxInterpretationWarning(warning: string): boolean {
  return (
    warning.startsWith("unresolved_") ||
    warning.startsWith("missing_tax_items:") ||
    warning === "normalized_amount_mismatch" ||
    warning.startsWith("taxable_amount_mismatch:") ||
    warning.startsWith("duplicate_tax_summary:") ||
    warning.startsWith("conflicting_tax_summary:")
  );
}

export function deriveTaxReviewReasons(
  interpretation: ReceiptTaxInterpretation | undefined,
): AiExpenseDraftReviewReason[] {
  const taxWarnings = (interpretation?.warnings ?? []).filter(isTaxInterpretationWarning);
  const hasUnresolvedTax = taxWarnings.some(
    (warning) => warning.startsWith("unresolved_") || warning.startsWith("missing_tax_items:"),
  );
  const hasTaxMismatch = taxWarnings.some(
    (warning) =>
      warning === "normalized_amount_mismatch" ||
      warning.startsWith("taxable_amount_mismatch:") ||
      warning.startsWith("duplicate_tax_summary:") ||
      warning.startsWith("conflicting_tax_summary:"),
  );
  return [
    ...(hasUnresolvedTax ? (["user_confirmation_required"] as const) : []),
    ...(hasTaxMismatch ? (["amount_mismatch"] as const) : []),
  ];
}

export function draftItemToExtractedReceiptItem(item: DraftItemTaxFields): ExtractedReceiptItem {
  return {
    itemName: item.itemName,
    printedAmountYen: item.printedAmountYen ?? 0,
    amountBasis: item.amountBasis ?? "unknown",
    taxRatePercent: item.taxRatePercent ?? null,
    markers: item.markers ?? (item.taxMarker ? [item.taxMarker] : []),
    taxMarker: item.taxMarker,
    categoryName: item.categoryName,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    warnings: item.warnings ?? [],
  };
}

export function buildReceiptTaxInput(args: {
  amountYen: number;
  items: DraftItemTaxFields[];
  taxSummaries: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
}): ReceiptTaxInput {
  return {
    amountYen: args.amountYen,
    items: args.items.map(draftItemToExtractedReceiptItem),
    taxSummaries: args.taxSummaries,
    markerDefinitions: args.markerDefinitions,
  };
}

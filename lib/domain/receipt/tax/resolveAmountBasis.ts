import type { AmountBasis, ExtractedTaxSummary } from "./types";

export function resolveAmountBasis(summary: ExtractedTaxSummary): AmountBasis {
  if (summary.taxableAmountBasis !== "unknown") return summary.taxableAmountBasis;
  if (summary.taxMode === "external") return "tax_excluded";
  if (summary.taxMode === "included") return "tax_included";
  return "unknown";
}

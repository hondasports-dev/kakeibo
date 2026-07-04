import type { ExtractedTaxSummary, ReceiptTaxInput, ReconciliationResult } from "./types";

function summaryKey(summary: ExtractedTaxSummary) {
  return [
    summary.taxRatePercent,
    summary.taxMode,
    summary.taxableAmountYen,
    summary.taxableAmountBasis,
    summary.taxYen,
    summary.taxIncludedAmountYen ?? "",
  ].join(":");
}

export function reconcileTaxSummaries(input: ReceiptTaxInput): ReconciliationResult {
  const seen = new Set<string>();
  const duplicateRates = new Set<number>();
  const taxSummaries = input.taxSummaries.filter((summary) => {
    const key = summaryKey(summary);
    if (seen.has(key)) {
      duplicateRates.add(summary.taxRatePercent);
      return false;
    }
    seen.add(key);
    return true;
  });
  return {
    taxSummaries,
    duplicateWarnings: [...duplicateRates].map((rate) => `duplicate_tax_summary:${rate}`),
  };
}

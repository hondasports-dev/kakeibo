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
  const countsByRate = new Map<number, number>();
  for (const summary of taxSummaries) {
    countsByRate.set(summary.taxRatePercent, (countsByRate.get(summary.taxRatePercent) ?? 0) + 1);
  }
  const conflictingRates = new Set(
    [...countsByRate].filter(([, count]) => count > 1).map(([rate]) => rate),
  );
  return {
    taxSummaries,
    resolvableTaxSummaries: taxSummaries.filter(
      (summary) => !conflictingRates.has(summary.taxRatePercent),
    ),
    duplicateWarnings: [...duplicateRates].map((rate) => `duplicate_tax_summary:${rate}`),
    conflictingWarnings: [...conflictingRates].map((rate) => `conflicting_tax_summary:${rate}`),
  };
}

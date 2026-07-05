import type { ExtractedTaxSummary } from "./types";

export function normalizeTaxSummaries(args: {
  amountYen: number;
  taxSummaries: ExtractedTaxSummary[];
}): ExtractedTaxSummary[] {
  if (args.taxSummaries.length !== 1) {
    return args.taxSummaries;
  }
  const [summary] = args.taxSummaries;
  if (
    summary.taxableAmountYen + summary.taxYen === args.amountYen &&
    summary.taxableAmountYen !== args.amountYen
  ) {
    return [
      {
        ...summary,
        taxMode: "external",
        taxableAmountBasis: "tax_excluded",
      },
    ];
  }
  return args.taxSummaries;
}

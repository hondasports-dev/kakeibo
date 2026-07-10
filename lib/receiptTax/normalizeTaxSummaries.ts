import { validateTaxSummaryConsistency } from "./taxSummaryConsistency";
import type { ExtractedTaxSummary } from "./types";

export function normalizeTaxSummaries(args: {
  amountYen: number;
  taxSummaries: ExtractedTaxSummary[];
  resolvableTaxSummaries?: ExtractedTaxSummary[];
}): ExtractedTaxSummary[] {
  return validateTaxSummaryConsistency({
    amountYen: args.amountYen,
    taxSummaries: args.taxSummaries,
    resolvableTaxSummaries: args.resolvableTaxSummaries,
  });
}

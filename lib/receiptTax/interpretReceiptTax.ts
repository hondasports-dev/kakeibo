import { collectTaxEvidence } from "./collectTaxEvidence";
import { normalizeAmounts } from "./normalizeAmounts";
import { reconcileTaxSummaries } from "./reconcileTaxSummaries";
import { resolveTaxContext } from "./resolveTaxContext";
import type { ReceiptTaxInput, ReceiptTaxInterpretation } from "./types";
import { validateConsistency } from "./validateConsistency";

export function interpretReceiptTax(input: ReceiptTaxInput): ReceiptTaxInterpretation {
  const normalizedInput = {
    ...input,
    items: input.items.map((item) => ({
      ...item,
      markers: item.markers.length > 0 ? item.markers : item.taxMarker ? [item.taxMarker] : [],
    })),
  };
  const evidence = collectTaxEvidence(normalizedInput);
  const reconciliation = reconcileTaxSummaries(normalizedInput);
  const contexts = resolveTaxContext({
    items: normalizedInput.items,
    taxSummaries: reconciliation.taxSummaries,
    evidence,
  });
  const items = normalizeAmounts({
    items: normalizedInput.items,
    contexts,
    taxSummaries: reconciliation.taxSummaries,
  });
  const validationWarnings = validateConsistency({
    amountYen: input.amountYen,
    items,
    taxSummaries: reconciliation.taxSummaries,
  });
  return {
    items,
    taxSummaries: reconciliation.taxSummaries,
    warnings: [...new Set([...reconciliation.duplicateWarnings, ...validationWarnings])],
  };
}

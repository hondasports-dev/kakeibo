import { collectTaxEvidence } from "./collectTaxEvidence";
import { normalizeAmounts } from "./normalizeAmounts";
import { normalizeTaxSummaries } from "./normalizeTaxSummaries";
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
  const reconciliation = reconcileTaxSummaries(normalizedInput);
  const normalizedSummaries = normalizeTaxSummaries({
    amountYen: input.amountYen,
    taxSummaries: reconciliation.resolvableTaxSummaries,
  });
  const evidence = collectTaxEvidence({
    ...normalizedInput,
    taxSummaries: normalizedSummaries,
  });
  const contexts = resolveTaxContext({
    amountYen: input.amountYen,
    items: normalizedInput.items,
    taxSummaries: normalizedSummaries,
    evidence,
  });
  const items = normalizeAmounts({
    amountYen: input.amountYen,
    items: normalizedInput.items,
    contexts,
    taxSummaries: normalizedSummaries,
  });
  const validationWarnings = validateConsistency({
    amountYen: input.amountYen,
    items,
    taxSummaries: normalizedSummaries,
  });
  return {
    items,
    taxSummaries: normalizedSummaries,
    warnings: [
      ...new Set([
        ...reconciliation.duplicateWarnings,
        ...reconciliation.conflictingWarnings,
        ...validationWarnings,
      ]),
    ],
  };
}

import { collectTaxEvidence } from "./collectTaxEvidence";
import { normalizeAmounts } from "./normalizeAmounts";
import { normalizeTaxSummaries } from "./normalizeTaxSummaries";
import { reconcileTaxSummaries } from "./reconcileTaxSummaries";
import { resolveTaxContext } from "./resolveTaxContext";
import type { ExtractedTaxSummary, ReceiptTaxInput, ReceiptTaxInterpretation } from "./types";
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
  const normalizedAllSummaries = normalizeTaxSummaries({
    amountYen: input.amountYen,
    taxSummaries: reconciliation.taxSummaries,
    resolvableTaxSummaries: reconciliation.resolvableTaxSummaries,
  });
  const normalizedResolvableSummaries = normalizeTaxSummaries({
    amountYen: input.amountYen,
    taxSummaries: reconciliation.resolvableTaxSummaries,
    resolvableTaxSummaries: reconciliation.resolvableTaxSummaries,
  });
  const processableSummaries = normalizedResolvableSummaries.filter(
    (summary): summary is ExtractedTaxSummary & { status: "coherent" | "reconcilable" } =>
      summary.status !== "conflicting",
  );
  const evidence = collectTaxEvidence({
    ...normalizedInput,
    taxSummaries: processableSummaries,
  });
  const contexts = resolveTaxContext({
    amountYen: input.amountYen,
    items: normalizedInput.items,
    taxSummaries: processableSummaries,
    evidence,
  });
  const items = normalizeAmounts({
    amountYen: input.amountYen,
    items: normalizedInput.items,
    contexts,
    taxSummaries: processableSummaries,
  });
  const validationWarnings = validateConsistency({
    amountYen: input.amountYen,
    items,
    taxSummaries: processableSummaries,
  });
  return {
    items,
    taxSummaries: normalizedAllSummaries,
    warnings: [
      ...new Set([
        ...reconciliation.duplicateWarnings,
        ...reconciliation.conflictingWarnings,
        ...validationWarnings,
      ]),
    ],
  };
}

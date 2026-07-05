import type {
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  InterpretedReceiptItem,
  TaxContextResolution,
} from "./types";
import { resolveAmountBasis } from "./resolveAmountBasis";

function allocateTax(taxYen: number, taxableAmountYen: number, amounts: number[]) {
  if (amounts.length === 0 || taxableAmountYen === 0) return amounts.map(() => 0);
  const shares = amounts.map((amount, index) => {
    const exact = (amount * taxYen) / taxableAmountYen;
    const base = Math.floor(exact);
    return { index, base, fraction: exact - base };
  });
  let remaining = taxYen - shares.reduce((sum, share) => sum + share.base, 0);
  const order = [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) order[index % order.length].base += 1;
  return shares.map((share) => share.base);
}

function hasTaxIncludedResolvedItem(result: InterpretedReceiptItem[]) {
  return result.some(
    (item) => item.taxContext.status === "resolved" && item.amountBasis === "tax_included",
  );
}

export function normalizeAmounts(args: {
  amountYen: number;
  items: ExtractedReceiptItem[];
  contexts: TaxContextResolution[];
  taxSummaries: ExtractedTaxSummary[];
}): InterpretedReceiptItem[] {
  const result = args.items.map((item, index) => {
    const context = args.contexts[index];
    const contextWarnings = context.status === "unresolved" ? context.reasons : [];
    return {
      ...item,
      taxRatePercent: context.taxRatePercent,
      amountBasis: context.amountBasis,
      taxContext: context,
      warnings: [...new Set([...item.warnings, ...contextWarnings])],
      allocatedTaxYen: 0,
      normalizedAmountYen: item.printedAmountYen,
    } satisfies InterpretedReceiptItem;
  });
  for (const summary of args.taxSummaries) {
    const amountBasis = resolveAmountBasis(summary);
    const indexes = result
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          item.taxContext.status === "resolved" &&
          item.taxRatePercent === summary.taxRatePercent &&
          (amountBasis === "unknown" || item.amountBasis === amountBasis),
      )
      .map(({ index }) => index);
    const printedTotal = indexes.reduce((sum, index) => sum + result[index].printedAmountYen, 0);
    if (indexes.length === 0) continue;

    let allocated = false;
    if (printedTotal === summary.taxableAmountYen) {
      const allocations = allocateTax(
        summary.taxYen,
        summary.taxableAmountYen,
        indexes.map((index) => result[index].printedAmountYen),
      );
      indexes.forEach((itemIndex, allocationIndex) => {
        result[itemIndex].allocatedTaxYen = allocations[allocationIndex];
        if (result[itemIndex].amountBasis === "tax_excluded") {
          result[itemIndex].normalizedAmountYen += allocations[allocationIndex];
        }
      });
      allocated = true;
    }

    if (
      !allocated &&
      args.taxSummaries.length === 1 &&
      amountBasis === "tax_excluded" &&
      !hasTaxIncludedResolvedItem(result)
    ) {
      const allPrintedTotal = result.reduce((sum, item) => sum + item.printedAmountYen, 0);
      const impliedTaxYen = args.amountYen - allPrintedTotal;
      if (impliedTaxYen > 0 && args.amountYen > allPrintedTotal && printedTotal > 0) {
        const allocations = allocateTax(
          impliedTaxYen,
          printedTotal,
          indexes.map((index) => result[index].printedAmountYen),
        );
        indexes.forEach((itemIndex, allocationIndex) => {
          result[itemIndex].allocatedTaxYen = allocations[allocationIndex];
          if (result[itemIndex].amountBasis === "tax_excluded") {
            result[itemIndex].normalizedAmountYen += allocations[allocationIndex];
          }
        });
      }
    }
  }
  return result;
}

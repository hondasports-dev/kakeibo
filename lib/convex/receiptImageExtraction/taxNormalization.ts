import type { AmountBasis, ExtractedTaxSummary, ReceiptItemTaxRatePercent } from "./types";

export type TaxNormalizableItem = {
  itemName: string;
  printedAmountYen: number;
  amountBasis: AmountBasis;
  taxRatePercent: ReceiptItemTaxRatePercent;
  taxMarker: string;
  categoryName?: string;
  quantity?: number;
  unitPriceYen?: number;
  warnings: string[];
};

export type NormalizedExpenseItem = TaxNormalizableItem & {
  allocatedTaxYen: number;
  normalizedAmountYen: number;
};

export type TaxNormalizationResult = {
  items: NormalizedExpenseItem[];
  warnings: string[];
};

function allocateByPrintedAmount(
  taxYen: number,
  taxableAmountYen: number,
  indexes: number[],
  items: TaxNormalizableItem[],
) {
  if (indexes.length === 0 || taxableAmountYen === 0) return indexes.map(() => 0);
  const shares = indexes.map((index) => {
    const exact = (items[index].printedAmountYen * taxYen) / taxableAmountYen;
    const base = Math.floor(exact);
    return { base, fraction: exact - base };
  });
  let remaining = taxYen - shares.reduce((sum, share) => sum + share.base, 0);
  const order = shares
    .map((share, index) => ({ ...share, index }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const share of order) {
    if (remaining <= 0) break;
    shares[share.index].base += 1;
    remaining -= 1;
  }
  return shares.map((share) => share.base);
}

export function normalizeReceiptAmounts(args: {
  amountYen: number;
  items: TaxNormalizableItem[];
  taxSummaries: ExtractedTaxSummary[];
}): TaxNormalizationResult {
  const warnings: string[] = [];
  const normalizedItems = args.items.map((item) => ({
    ...item,
    allocatedTaxYen: 0,
    normalizedAmountYen: item.printedAmountYen,
  }));

  args.items.forEach((item, index) => {
    if (item.taxRatePercent === null) warnings.push(`unknown_tax_rate:items[${index}]`);
    if (item.amountBasis === "unknown") warnings.push(`unknown_amount_basis:items[${index}]`);
  });

  for (const summary of args.taxSummaries) {
    const expectedBasis = summary.taxMode === "external" ? "tax_excluded" : "tax_included";
    const indexes = args.items
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          item.taxRatePercent === summary.taxRatePercent && item.amountBasis === expectedBasis,
      )
      .map(({ index }) => index);
    if (indexes.length === 0) {
      warnings.push(`missing_tax_items:${summary.taxRatePercent}`);
      continue;
    }
    const printedTotal = indexes.reduce(
      (sum, index) => sum + args.items[index].printedAmountYen,
      0,
    );
    if (printedTotal !== summary.taxableAmountYen) {
      warnings.push(`taxable_amount_mismatch:${summary.taxRatePercent}`);
    }
    const allocations = allocateByPrintedAmount(summary.taxYen, printedTotal, indexes, args.items);
    indexes.forEach((itemIndex, allocationIndex) => {
      const allocatedTaxYen = allocations[allocationIndex];
      normalizedItems[itemIndex].allocatedTaxYen += allocatedTaxYen;
      if (summary.taxMode === "external") {
        normalizedItems[itemIndex].normalizedAmountYen += allocatedTaxYen;
      }
    });
  }

  const normalizedTotal = normalizedItems.reduce((sum, item) => sum + item.normalizedAmountYen, 0);
  if (normalizedTotal !== args.amountYen) warnings.push("normalized_amount_mismatch");
  return { items: normalizedItems, warnings };
}

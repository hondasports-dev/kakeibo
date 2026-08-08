export type ExtractedReceiptItemLike = {
  itemName: string;
  printedAmountYen?: number;
  amountYen: number;
};

export type ExtractedTaxSummaryLike = {
  taxYen: number;
  taxableAmountYen: number;
  taxIncludedAmountYen?: number;
};

const TAX_SUMMARY_ITEM_NAME_PATTERN =
  /(?:消費税(?:等|計)?|税合計|(?:[0-9０-９]+\s*[%％]|[（(])[^）)]*(?:内税|外税)|(?:内税|外税)(?:額|計|対象|タイショウ|$))/;

export function isTaxSummaryItem(
  item: ExtractedReceiptItemLike,
  taxSummaries: ExtractedTaxSummaryLike[],
): boolean {
  const printedAmountYen = item.printedAmountYen ?? item.amountYen;
  if (printedAmountYen <= 0 || !TAX_SUMMARY_ITEM_NAME_PATTERN.test(item.itemName)) {
    return false;
  }
  const taxAmounts = new Set(
    taxSummaries.flatMap((summary) => [
      summary.taxYen,
      summary.taxableAmountYen,
      ...(summary.taxIncludedAmountYen === undefined ? [] : [summary.taxIncludedAmountYen]),
    ]),
  );
  taxAmounts.add(taxSummaries.reduce((sum, summary) => sum + summary.taxYen, 0));
  return taxAmounts.has(printedAmountYen);
}

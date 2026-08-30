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

import { classifyReceiptLines } from "../receipt/lineClassification";

export function isTaxSummaryItem(
  item: ExtractedReceiptItemLike,
  taxSummaries: ExtractedTaxSummaryLike[],
): boolean {
  const printedAmountYen = item.printedAmountYen ?? item.amountYen;
  if (printedAmountYen <= 0) return false;
  const [classification] = classifyReceiptLines(
    [
      {
        rawText: item.itemName,
        amountText: String(printedAmountYen),
        amountYen: printedAmountYen,
        lineRoleCandidates: ["item"],
        roleConfidence: 0.5,
        explicitlyPrinted: true,
        sourceLineIndex: 0,
      },
    ],
    {
      taxAmountsYen: taxSummaries.flatMap((summary) => [
        summary.taxYen,
        summary.taxableAmountYen,
        ...(summary.taxIncludedAmountYen === undefined ? [] : [summary.taxIncludedAmountYen]),
      ]),
    },
  );
  return classification?.candidates[0]?.role === "tax";
}

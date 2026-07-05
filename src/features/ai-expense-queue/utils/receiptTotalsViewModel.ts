import type { AiExpenseDraft, ReviewItemValues } from "../types/types";
import { buildTaxContextFromReviewItem } from "./receiptItemTaxViewModel";
import { formatYenLabel } from "./receiptTaxLabels";
import { getTaxModeLabel } from "./receiptItemTaxViewModel";

export type ReceiptTotalsStatus = "matched" | "mismatch" | "subtotalUnavailable";

export type ReceiptTotalsViewModel = {
  status: ReceiptTotalsStatus;
  paidTotalYen?: number;
  paidTotalLabel: string;
  itemsPrintedTotalYen: number;
  itemsPrintedTotalLabel: string;
  receiptSubtotalYen?: number;
  receiptSubtotalLabel: string;
  subtotalRateLabel?: string;
  gapPaidVsItems?: number;
  gapItemsVsSubtotal?: number;
  gapPaidVsItemsNote?: string;
  gapItemsVsSubtotalNote?: string;
  guidanceLines: string[];
  unresolvedCount: number;
  showPanel: boolean;
  canBulkApplyTax: boolean;
  bulkTaxLabel?: string;
};

function sumItemsPrintedTotal(reviewItems: ReviewItemValues[]): number {
  return reviewItems.reduce((sum, item) => {
    if (item.taxResolutionStatus === "resolved" && item.printedAmountYen != null) {
      return sum + item.printedAmountYen;
    }
    const printed =
      item.printedAmountYen ??
      (Number.isFinite(Number(item.amountYen)) ? Number(item.amountYen) : 0);
    return sum + printed;
  }, 0);
}

function resolveReceiptSubtotal(taxSummaries: AiExpenseDraft["taxSummaries"]): {
  subtotalYen?: number;
  rateLabel?: string;
} {
  if (!taxSummaries || taxSummaries.length === 0) {
    return {};
  }
  if (taxSummaries.length === 1) {
    const summary = taxSummaries[0];
    return {
      subtotalYen: summary.taxableAmountYen,
      rateLabel: `${summary.taxRatePercent}%${getTaxModeLabel(summary.taxMode)}`,
    };
  }
  const subtotalYen = taxSummaries.reduce((sum, s) => sum + s.taxableAmountYen, 0);
  return { subtotalYen, rateLabel: "税率別" };
}

function formatGapNote(gap: number, referenceLabel: string): string {
  const abs = Math.abs(gap).toLocaleString("ja-JP");
  if (gap > 0) {
    return `${referenceLabel}より${abs}円多い`;
  }
  if (gap < 0) {
    return `${referenceLabel}より${abs}円少ない`;
  }
  return "";
}

function buildGuidanceLines(args: {
  gapPaidVsItems?: number;
  gapItemsVsSubtotal?: number;
  unresolvedCount: number;
  hasSubtotal: boolean;
  canBulkApplyTax: boolean;
}): string[] {
  const lines: string[] = [];
  const allMatched =
    (args.gapPaidVsItems === undefined || args.gapPaidVsItems === 0) &&
    (args.gapItemsVsSubtotal === undefined || args.gapItemsVsSubtotal === 0) &&
    args.unresolvedCount === 0;

  if (allMatched) {
    lines.push("金額は一致しています");
    return lines;
  }

  if (args.unresolvedCount > 0) {
    if (args.canBulkApplyTax) {
      lines.push(
        `${args.unresolvedCount}件の税率が未確定です。下の一括適用を試すか、金額を確認してください`,
      );
    } else {
      lines.push(`${args.unresolvedCount}件の税率が未確定です。金額を確認してください`);
    }
  }

  if (args.gapPaidVsItems !== undefined && args.gapPaidVsItems !== 0) {
    const abs = Math.abs(args.gapPaidVsItems).toLocaleString("ja-JP");
    if (args.gapPaidVsItems > 0) {
      lines.push(`お支払いより${abs}円不足しています`);
    } else {
      lines.push(`お支払いより${abs}円超過しています`);
    }
  }

  if (args.hasSubtotal && args.gapItemsVsSubtotal !== undefined && args.gapItemsVsSubtotal !== 0) {
    const abs = Math.abs(args.gapItemsVsSubtotal).toLocaleString("ja-JP");
    lines.push(
      `読み取った商品の合計とレシート小計が${abs}円ずれています。金額が怪しい行を確認してください`,
    );
  }

  return lines.slice(0, 2);
}

export function toReceiptTotalsViewModel(args: {
  reviewItems: ReviewItemValues[];
  paidTotalYen?: number;
  taxSummaries?: AiExpenseDraft["taxSummaries"];
}): ReceiptTotalsViewModel {
  const { reviewItems, paidTotalYen, taxSummaries } = args;
  const showPanel = reviewItems.length > 0;

  const itemsPrintedTotalYen = sumItemsPrintedTotal(reviewItems);
  const { subtotalYen: receiptSubtotalYen, rateLabel: subtotalRateLabel } =
    resolveReceiptSubtotal(taxSummaries);

  const gapPaidVsItems =
    paidTotalYen !== undefined ? paidTotalYen - itemsPrintedTotalYen : undefined;
  const gapItemsVsSubtotal =
    receiptSubtotalYen !== undefined ? itemsPrintedTotalYen - receiptSubtotalYen : undefined;

  const unresolvedCount = reviewItems.filter(
    (item) => buildTaxContextFromReviewItem(item).status === "unresolved",
  ).length;

  const canBulkApplyTax =
    (taxSummaries?.length ?? 0) === 1 &&
    unresolvedCount > 0 &&
    taxSummaries![0].taxMode !== "unknown" &&
    taxSummaries![0].taxMode !== "mixed";

  let bulkTaxLabel: string | undefined;
  if (canBulkApplyTax && taxSummaries?.[0]) {
    const summary = taxSummaries[0];
    bulkTaxLabel = `このレシートは「${summary.taxRatePercent}%・${getTaxModeLabel(summary.taxMode)}」と読み取りました`;
  }

  const hasSubtotal = receiptSubtotalYen !== undefined;
  const guidanceLines = buildGuidanceLines({
    gapPaidVsItems,
    gapItemsVsSubtotal,
    unresolvedCount,
    hasSubtotal,
    canBulkApplyTax,
  });

  const hasMismatch =
    (gapPaidVsItems !== undefined && gapPaidVsItems !== 0) ||
    (gapItemsVsSubtotal !== undefined && gapItemsVsSubtotal !== 0) ||
    unresolvedCount > 0;

  const status: ReceiptTotalsStatus = !hasSubtotal
    ? hasMismatch
      ? "mismatch"
      : "subtotalUnavailable"
    : hasMismatch
      ? "mismatch"
      : "matched";

  return {
    status,
    paidTotalYen,
    paidTotalLabel: formatYenLabel(paidTotalYen),
    itemsPrintedTotalYen,
    itemsPrintedTotalLabel: formatYenLabel(itemsPrintedTotalYen),
    receiptSubtotalYen,
    receiptSubtotalLabel: hasSubtotal ? formatYenLabel(receiptSubtotalYen) : "読み取れませんでした",
    subtotalRateLabel,
    gapPaidVsItems,
    gapItemsVsSubtotal,
    gapPaidVsItemsNote:
      gapPaidVsItems !== undefined && gapPaidVsItems !== 0
        ? formatGapNote(-gapPaidVsItems, "お支払い")
        : undefined,
    gapItemsVsSubtotalNote:
      gapItemsVsSubtotal !== undefined && gapItemsVsSubtotal !== 0
        ? formatGapNote(-gapItemsVsSubtotal, "商品合計")
        : undefined,
    guidanceLines,
    unresolvedCount,
    showPanel,
    canBulkApplyTax,
    bulkTaxLabel,
  };
}

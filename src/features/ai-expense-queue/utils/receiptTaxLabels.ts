import type { AmountBasis, TaxResolutionSource } from "../../../../lib/receiptTax/types";

export const TAX_RESOLUTION_SOURCE_LABELS = {
  item_explicit: "レシート明細に税率表記があります",
  single_summary: "単一の税率別集計と明細合計が一致しました",
  summary_reconciliation: "税率別対象額との金額整合から判定しました",
  remaining_summary: "他の税率区分を除いた残額と一致しました",
  marker_reconciled: "レシート記号の情報と税率別対象額が一致しました",
} satisfies Record<TaxResolutionSource, string>;

export const TAX_REVIEW_REASON_LABELS: Record<string, string> = {
  multiple_tax_summaries: "複数の税率があり、明細との対応を特定できませんでした",
  cannot_reconcile_item_amounts: "明細金額と税率別対象額が一致しませんでした",
  unresolved_tax_rate: "税率を判定できませんでした",
  unresolved_amount_basis: "印字金額が税込か税抜か判定できませんでした",
  taxable_amount_mismatch: "税率別対象額と明細合計が一致しません",
  normalized_amount_mismatch: "登録金額合計と支払合計が一致しません",
};

export const AMOUNT_BASIS_LABELS = {
  tax_included: "税込印字",
  tax_excluded: "税抜印字",
  unknown: "不明",
} satisfies Record<AmountBasis, string>;

export function getReviewReasonLabel(reason: string): string {
  return TAX_REVIEW_REASON_LABELS[reason] ?? "分析結果に確認が必要な項目があります";
}

export function getTaxResolutionSourceLabel(source: TaxResolutionSource): string {
  return TAX_RESOLUTION_SOURCE_LABELS[source];
}

export function getAmountBasisLabel(amountBasis: AmountBasis): string {
  return AMOUNT_BASIS_LABELS[amountBasis];
}

export function formatTaxRateLabel(taxRatePercent: 0 | 8 | 10 | null | undefined): string {
  if (taxRatePercent === null || taxRatePercent === undefined) {
    return "未設定";
  }
  return `${taxRatePercent}%`;
}

export function formatYenLabel(amountYen: number | undefined): string {
  if (amountYen === undefined) {
    return "—";
  }
  return `${amountYen.toLocaleString("ja-JP")}円`;
}

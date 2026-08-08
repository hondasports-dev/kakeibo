import type { AmountBasis, DraftSummaryOverride, TaxMode, TaxRatePercent } from "./types";

export type SummaryOverrideInput = {
  index: number;
  taxRatePercent?: TaxRatePercent;
  taxMode?: TaxMode;
  taxableAmountYen?: number;
  taxableAmountBasis?: AmountBasis;
  taxYen?: number;
  taxIncludedAmountYen?: number;
};

function assertNonNegativeFinite(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
}

/**
 * 税サマリー上書き用オブジェクトを構築する。
 * 数値フィールドは有限な非負数であることを検証し、
 * 少なくとも1つのフィールドが指定されていない場合はエラーとする。
 */
export function buildDraftSummaryOverride(input: SummaryOverrideInput): DraftSummaryOverride {
  assertNonNegativeFinite(input.taxableAmountYen, "taxableAmountYen");
  assertNonNegativeFinite(input.taxYen, "taxYen");
  assertNonNegativeFinite(input.taxIncludedAmountYen, "taxIncludedAmountYen");

  const summary: DraftSummaryOverride["summary"] = {};
  if (input.taxRatePercent !== undefined) summary.taxRatePercent = input.taxRatePercent;
  if (input.taxMode !== undefined) summary.taxMode = input.taxMode;
  if (input.taxableAmountYen !== undefined) summary.taxableAmountYen = input.taxableAmountYen;
  if (input.taxableAmountBasis !== undefined) summary.taxableAmountBasis = input.taxableAmountBasis;
  if (input.taxYen !== undefined) summary.taxYen = input.taxYen;
  if (input.taxIncludedAmountYen !== undefined)
    summary.taxIncludedAmountYen = input.taxIncludedAmountYen;

  if (Object.keys(summary).length === 0) {
    throw new Error("At least one tax override field must be provided");
  }

  return { index: input.index, summary };
}

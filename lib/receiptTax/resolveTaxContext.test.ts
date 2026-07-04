import { describe, expect, it } from "vitest";
import { resolveTaxContext } from "./resolveTaxContext";
import type { ExtractedReceiptItem, ExtractedTaxSummary, TaxEvidence } from "./types";

const item = (printedAmountYen: number): ExtractedReceiptItem => ({
  itemName: "item",
  printedAmountYen,
  taxRatePercent: null,
  amountBasis: "unknown",
  markers: [],
  warnings: [],
});

const summary = (taxRatePercent: 8 | 10, taxableAmountYen: number): ExtractedTaxSummary => ({
  taxRatePercent,
  taxMode: "included",
  taxableAmountYen,
  taxableAmountBasis: "tax_included",
  taxYen: 0,
  roundingMethod: "unknown",
  confidence: {},
  warnings: [],
});

describe("resolveTaxContext", () => {
  it("明示税率にsummaryからbasisを補完した由来をsummary照合として記録する", () => {
    const explicitRateItem = { ...item(100), taxRatePercent: 8 as const };
    const [context] = resolveTaxContext({
      items: [explicitRateItem],
      taxSummaries: [summary(8, 100)],
      evidence: [],
    });

    expect(context).toMatchObject({ status: "resolved", source: "summary_reconciliation" });
  });

  it("同額明細を含む一意な部分集合を過去stateの汚染なく解決する", () => {
    const contexts = resolveTaxContext({
      items: [item(5), item(5), item(20), item(7)],
      taxSummaries: [summary(8, 10), summary(10, 20)],
      evidence: [],
    });

    expect(contexts.map((context) => context.taxRatePercent)).toEqual([8, 8, 10, null]);
  });

  it("異なる税率が競合したmarkerは後続の同率証拠でも復活させない", () => {
    const evidence: TaxEvidence[] = [
      {
        type: "marker_legend",
        itemIndex: 0,
        marker: "a",
        description: "8%対象",
        interpretedTaxRatePercent: 8,
      },
      {
        type: "marker_legend",
        itemIndex: 0,
        marker: "b",
        description: "10%対象",
        interpretedTaxRatePercent: 10,
      },
      {
        type: "marker_legend",
        itemIndex: 0,
        marker: "c",
        description: "8%対象",
        interpretedTaxRatePercent: 8,
      },
    ];
    const [context] = resolveTaxContext({
      items: [item(100)],
      taxSummaries: [summary(8, 100)],
      evidence,
    });

    expect(context).toMatchObject({ status: "resolved", source: "single_summary" });
  });
});

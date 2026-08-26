import { describe, expect, it } from "vitest";
import { isTaxSummaryItem } from "./extraction";

describe("isTaxSummaryItem", () => {
  const taxSummaries = [
    { taxYen: 80, taxableAmountYen: 1000, taxIncludedAmountYen: 1080 },
    { taxYen: 50, taxableAmountYen: 500 },
  ];

  it("税サマリー金額と一致する税関連商品名は true", () => {
    expect(
      isTaxSummaryItem({ itemName: "消費税", amountYen: 80, printedAmountYen: 80 }, taxSummaries),
    ).toBe(true);
  });

  it("税合計金額と一致する", () => {
    expect(
      isTaxSummaryItem({ itemName: "税合計", amountYen: 130, printedAmountYen: 130 }, taxSummaries),
    ).toBe(true);
  });

  it("税ラベルが明示されていれば金額不一致でも true", () => {
    expect(
      isTaxSummaryItem({ itemName: "消費税", amountYen: 999, printedAmountYen: 999 }, taxSummaries),
    ).toBe(true);
  });

  it("普通の商品は false", () => {
    expect(isTaxSummaryItem({ itemName: "りんご", amountYen: 100 }, taxSummaries)).toBe(false);
  });

  it("金額が 0 以下は false", () => {
    expect(isTaxSummaryItem({ itemName: "消費税", amountYen: 0 }, taxSummaries)).toBe(false);
  });
});

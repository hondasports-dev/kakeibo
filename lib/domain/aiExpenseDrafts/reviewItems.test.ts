import { describe, expect, it } from "vitest";
import {
  hasLowConfidenceItem,
  summarizeItems,
  validatePositiveCategoryTotals,
} from "./reviewItems";

describe("hasLowConfidenceItem", () => {
  it("すべての信頼度が閾値以上なら false", () => {
    expect(
      hasLowConfidenceItem({ confidence: { itemName: 0.9, amountYen: 0.9, categoryId: 0.9 } }),
    ).toBe(false);
  });

  it("いずれかが閾値未満なら true", () => {
    expect(
      hasLowConfidenceItem({ confidence: { itemName: 0.7, amountYen: 0.9, categoryId: 0.9 } }),
    ).toBe(true);
    expect(hasLowConfidenceItem({ confidence: { amountYen: 0.7 } })).toBe(true);
  });

  it("categoryName で代替できる", () => {
    expect(hasLowConfidenceItem({ confidence: { categoryName: 0.7 } })).toBe(true);
  });
});

describe("summarizeItems", () => {
  it("空配列なら undefined", () => {
    expect(summarizeItems({ amountYen: 1000 }, [])).toBeUndefined();
  });

  it("明細を合計しカテゴリごとに集計する", () => {
    const result = summarizeItems({ amountYen: 1000 }, [
      { amountYen: 500, categoryId: "cat1", confidence: {} },
      { amountYen: 300, categoryId: "cat2", confidence: {} },
      { amountYen: 200, categoryId: "cat1", confidence: {} },
    ]);
    expect(result).toMatchObject({
      itemTotalYen: 1000,
      itemDifferenceYen: 0,
      hasUncategorizedItems: false,
      hasLowConfidenceItems: false,
      categoryAggregates: [
        { categoryId: "cat1", amountYen: 700 },
        { categoryId: "cat2", amountYen: 300 },
      ],
    });
  });

  it("categoryId が未設定なら hasUncategorizedItems が true", () => {
    const result = summarizeItems({ amountYen: 100 }, [{ amountYen: 100, confidence: {} }]);
    expect(result?.hasUncategorizedItems).toBe(true);
  });

  it("低信頼度明細があれば hasLowConfidenceItems が true", () => {
    const result = summarizeItems({ amountYen: 100 }, [
      { amountYen: 100, categoryId: "cat1", confidence: { itemName: 0.7 } },
    ]);
    expect(result?.hasLowConfidenceItems).toBe(true);
  });
});

describe("validatePositiveCategoryTotals", () => {
  it("カテゴリ合計がすべて正なら true", () => {
    expect(
      validatePositiveCategoryTotals([
        { categoryId: "cat1", amountYen: 500 },
        { categoryId: "cat1", amountYen: -100 },
        { categoryId: "cat1", amountYen: 700 },
      ]),
    ).toBe(true);
  });

  it("カテゴリ合計が 0 以下なら false", () => {
    expect(
      validatePositiveCategoryTotals([
        { categoryId: "cat1", amountYen: 500 },
        { categoryId: "cat1", amountYen: -500 },
      ]),
    ).toBe(false);
  });
});

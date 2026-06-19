import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  validateExpenseItems,
  validateExpenseItemEntry,
  type ExpenseItemEntryInput,
} from "./expenseItems";

// テスト用: 文字列リテラルを Id<"categories"> として扱うヘルパー
const catId = (s: string) => s as Id<"categories">;

describe("validateExpenseItemEntry", () => {
  it("正常なカテゴリ・金額・タイトルで success: true を返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "2000",
      title: "食料品",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountYen).toBe(2000);
      expect(result.data.categoryId).toBe("cat-food");
      expect(result.data.title).toBe("食料品");
    }
  });

  it("カテゴリ未選択の場合、categoryId エラーを返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: "",
      amountYen: "2000",
      title: "食料品",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.categoryId).toBeTruthy();
    }
  });

  it("金額が0円の場合、amountYen エラーを返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "0",
      title: "食料品",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeTruthy();
    }
  });

  it("金額が9,999,999円を超える場合、amountYen エラーを返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "10000000",
      title: "食料品",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeTruthy();
    }
  });

  it("タイトルが空の場合、title エラーを返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "2000",
      title: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.title).toBeTruthy();
    }
  });

  it("メモが空文字列の場合、undefined として扱う", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "2000",
      title: "食料品",
      memo: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memo).toBeUndefined();
    }
  });

  it("メモが500文字を超える場合、memo エラーを返す", () => {
    const result = validateExpenseItemEntry({
      categoryId: catId("cat-food"),
      amountYen: "2000",
      title: "食料品",
      memo: "a".repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.memo).toBeTruthy();
    }
  });
});

describe("validateExpenseItems", () => {
  const validItem: ExpenseItemEntryInput = {
    categoryId: catId("cat-food"),
    amountYen: "2000",
    title: "食料品",
  };

  it("差額が0円の場合、difference: 0 で success: true を返す", () => {
    const result = validateExpenseItems({
      sourceAmount: 5000,
      items: [
        { categoryId: catId("cat-food"), amountYen: "3000", title: "食費" },
        { categoryId: catId("cat-daily"), amountYen: "2000", title: "日用品" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difference).toBe(0);
    }
  });

  it("差額がプラス（未配分）の場合、difference > 0 で success: true を返す", () => {
    const result = validateExpenseItems({
      sourceAmount: 5000,
      items: [
        { categoryId: catId("cat-food"), amountYen: "3000", title: "食費" },
        { categoryId: catId("cat-daily"), amountYen: "1500", title: "日用品" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difference).toBe(500);
    }
  });

  it("差額がマイナス（超過）の場合、success: false と difference を返す", () => {
    const result = validateExpenseItems({
      sourceAmount: 5000,
      items: [
        { categoryId: catId("cat-food"), amountYen: "3000", title: "食費" },
        { categoryId: catId("cat-daily"), amountYen: "2500", title: "日用品" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success && result.reason === "amount_exceeded") {
      expect(result.difference).toBe(-500);
    }
    if (!result.success) {
      expect(result.reason).toBe("amount_exceeded");
    }
  });

  it("項目リストが空の場合、success: false を返す", () => {
    const result = validateExpenseItems({
      sourceAmount: 5000,
      items: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("no_items");
    }
  });

  it("いずれかの項目にバリデーションエラーがある場合、success: false を返す", () => {
    const result = validateExpenseItems({
      sourceAmount: 5000,
      items: [
        { categoryId: "", amountYen: "3000", title: "食費" },
        { categoryId: catId("cat-daily"), amountYen: "2000", title: "日用品" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("item_errors");
    }
  });

  it("sourceAmount が未指定（undefined）の場合、差額チェックをスキップして success: true", () => {
    const result = validateExpenseItems({
      sourceAmount: undefined,
      items: [validItem],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difference).toBeNull();
    }
  });
});

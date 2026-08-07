import { describe, expect, it } from "vitest";
import {
  EXPENSE_ENTRY_AMOUNT_MAX,
  EXPENSE_ENTRY_MEMO_MAX_LENGTH,
  EXPENSE_ENTRY_TITLE_MAX_LENGTH,
  parseExpenseAmountString,
  validateExpenseAmount,
  validateExpenseItem,
  validateExpenseItemInput,
  validateExpenseMemo,
  validateExpenseTitle,
} from "./expenseEntryItem";

describe("domain constants", () => {
  it("支出項目の制約値が期待通り", () => {
    expect(EXPENSE_ENTRY_TITLE_MAX_LENGTH).toBe(100);
    expect(EXPENSE_ENTRY_MEMO_MAX_LENGTH).toBe(500);
    expect(EXPENSE_ENTRY_AMOUNT_MAX).toBe(9_999_999);
  });
});

describe("validateExpenseAmount", () => {
  it.each([1, 9_999_999, 1000])("%s 円は有効", (amount) => {
    expect(validateExpenseAmount(amount)).toEqual({ success: true });
  });

  it.each([0, -1, 1.5, Number.NaN])("%s は有効な支出金額ではない", (amount) => {
    const result = validateExpenseAmount(amount);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("not_positive_integer");
    }
  });

  it("最大金額を超える場合は too_large", () => {
    const result = validateExpenseAmount(10_000_000);
    expect(result).toEqual({ success: false, error: "too_large" });
  });
});

describe("parseExpenseAmountString", () => {
  it.each([
    ["1", 1],
    ["9999999", 9_999_999],
    ["0123", 123],
  ])("%s -> %s", (input, expected) => {
    expect(parseExpenseAmountString(input)).toEqual({
      success: true,
      amountYen: expected,
    });
  });

  it.each([
    ["", "required"],
    ["abc", "not_number"],
    ["-1", "not_positive"],
    ["0", "not_positive"],
    ["1.5", "not_number"],
    ["10000000", "too_large"],
  ])("%s -> %s", (input, expectedError) => {
    const result = parseExpenseAmountString(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(expectedError);
    }
  });
});

describe("validateExpenseTitle", () => {
  it("前後の空白を trim して成功する", () => {
    expect(validateExpenseTitle(" 食料品 ")).toEqual({
      success: true,
      title: "食料品",
    });
  });

  it("空文字は empty", () => {
    expect(validateExpenseTitle("   ")).toEqual({
      success: false,
      error: "empty",
    });
  });

  it("最大長を超える場合は too_long", () => {
    const result = validateExpenseTitle("a".repeat(EXPENSE_ENTRY_TITLE_MAX_LENGTH + 1));
    expect(result).toEqual({ success: false, error: "too_long" });
  });
});

describe("validateExpenseMemo", () => {
  it("undefined は有効", () => {
    expect(validateExpenseMemo(undefined)).toEqual({ success: true });
  });

  it("空文字は undefined として扱う", () => {
    expect(validateExpenseMemo("")).toEqual({ success: true, memo: undefined });
  });

  it("最大長を超える場合は too_long", () => {
    const result = validateExpenseMemo("a".repeat(EXPENSE_ENTRY_MEMO_MAX_LENGTH + 1));
    expect(result).toEqual({ success: false, error: "too_long" });
  });
});

describe("validateExpenseItem", () => {
  it("有効な数値金額の項目を検証する", () => {
    const result = validateExpenseItem({
      categoryId: "cat-food",
      amountYen: 2000,
      title: "食料品",
    });
    expect(result.success).toBe(true);
  });

  it.each([0, -1, 1.5, 10_000_000])("不正な金額 %s を拒否する", (amount) => {
    const result = validateExpenseItem({
      categoryId: "cat-food",
      amountYen: amount,
      title: "食料品",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeTruthy();
    }
  });
});

describe("validateExpenseItemInput", () => {
  it("文字列金額を数値に変換して成功する", () => {
    const result = validateExpenseItemInput({
      categoryId: "cat-food",
      amountYen: "2000",
      title: "食料品",
      memo: "",
    });
    expect(result).toEqual({
      success: true,
      data: {
        categoryId: "cat-food",
        amountYen: 2000,
        title: "食料品",
        memo: undefined,
      },
    });
  });

  it("全項目を同時に検証する", () => {
    const result = validateExpenseItemInput({
      categoryId: "",
      amountYen: "abc",
      title: "",
      memo: "a".repeat(EXPENSE_ENTRY_MEMO_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.categoryId).toBe("empty");
      expect(result.errors.amountYen).toBe("not_number");
      expect(result.errors.title).toBe("empty");
      expect(result.errors.memo).toBe("too_long");
    }
  });
});

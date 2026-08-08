import { describe, expect, it } from "vitest";
import { buildDraftExpenseEntry, getDraftExpenseEntryErrorMessage } from "./createFromDraft";

describe("buildDraftExpenseEntry", () => {
  it("明細の categoryId を優先する", () => {
    const result = buildDraftExpenseEntry(
      { itemName: "食品", amountYen: 500, categoryId: "item-cat" },
      "draft-cat",
    );
    expect(result).toEqual({
      success: true,
      entry: { amount: 500, categoryId: "item-cat", title: "食品" },
    });
  });

  it("明細の categoryId がなければ下書きの categoryId を使う", () => {
    const result = buildDraftExpenseEntry({ amountYen: 500 }, "draft-cat");
    expect(result).toEqual({
      success: true,
      entry: { amount: 500, categoryId: "draft-cat", title: "不明" },
    });
  });

  it("itemName が undefined なら 不明 を fallback する", () => {
    const result = buildDraftExpenseEntry({ amountYen: 500, categoryId: "cat" }, undefined);
    expect(result).toEqual({
      success: true,
      entry: { amount: 500, categoryId: "cat", title: "不明" },
    });
  });

  it("itemName が空文字列ならエラー", () => {
    const result = buildDraftExpenseEntry(
      { itemName: "", amountYen: 500, categoryId: "cat" },
      undefined,
    );
    expect(result).toEqual({ success: false, error: "invalid_title" });
  });

  it("無効な金額を拒否する", () => {
    const result = buildDraftExpenseEntry({ amountYen: 0, categoryId: "cat" }, undefined);
    expect(result).toEqual({ success: false, error: "invalid_amount" });
  });

  it("カテゴリ ID が不足ならエラー", () => {
    const result = buildDraftExpenseEntry({ amountYen: 500 }, undefined);
    expect(result).toEqual({ success: false, error: "missing_category" });
  });

  it("長すぎるタイトルを拒否する", () => {
    const result = buildDraftExpenseEntry(
      { itemName: "a".repeat(101), amountYen: 500, categoryId: "cat" },
      undefined,
    );
    expect(result).toEqual({ success: false, error: "invalid_title" });
  });
});

describe("getDraftExpenseEntryErrorMessage", () => {
  it.each([
    ["invalid_amount", "Amount must be a positive integer"],
    ["missing_category", "Category ID is required"],
    ["invalid_title", "Title is required"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getDraftExpenseEntryErrorMessage(error)).toBe(expected);
  });
});

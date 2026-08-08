import { describe, expect, it } from "vitest";
import {
  addLegacyReceiptGroups,
  mapExpenseEntryToSpendingEntry,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
} from "./spendingEntry";

describe("mapReceiptToSpendingEntry", () => {
  it("レシートを spending entry へ変換する", () => {
    expect(
      mapReceiptToSpendingEntry({
        _id: "r1",
        date: "2024-01-10",
        type: "expense",
        shopName: "スーパー",
        amountYen: 1000,
        categoryId: "cat-1",
      }),
    ).toEqual({
      _id: "r1",
      date: "2024-01-10",
      type: "expense",
      shopName: "スーパー",
      amountYen: 1000,
      categoryId: "cat-1",
      recordType: "receipt",
    });
  });
});

describe("mapExpenseEntryToSpendingEntry", () => {
  it("支出明細を spending entry へ変換する", () => {
    const result = mapExpenseEntryToSpendingEntry({
      _id: "e1",
      date: "2024-01-10",
      amount: 500,
      categoryId: "cat-1",
      title: "コーヒー",
      entryType: "expense",
    });
    expect(result.success).toBe(true);
    expect(result).toEqual({
      success: true,
      entry: {
        _id: "e1",
        date: "2024-01-10",
        type: "expense",
        shopName: "コーヒー",
        amountYen: 500,
        categoryId: "cat-1",
        recordType: "expenseEntry",
      },
    });
  });

  it("categoryId が未設定なら失敗", () => {
    const result = mapExpenseEntryToSpendingEntry({
      _id: "e2",
      date: "2024-01-10",
      amount: 500,
      categoryId: null,
      title: "コーヒー",
      entryType: "expense",
    });
    expect(result.success).toBe(false);
  });

  it("収入明細では title を bankName として扱う", () => {
    const result = mapExpenseEntryToSpendingEntry({
      _id: "e3",
      date: "2024-01-10",
      amount: 200000,
      categoryId: "cat-1",
      title: "給与",
      entryType: "income",
    });
    expect(result.success && result.entry.bankName).toBe("給与");
  });
});

describe("mapIncomeExpenseEntryToListEntry", () => {
  it("支出明細を income list entry へ変換する", () => {
    expect(
      mapIncomeExpenseEntryToListEntry({
        _id: "e1",
        date: "2024-01-10",
        amount: 200000,
        title: "給与",
      }),
    ).toEqual({
      _id: "e1",
      date: "2024-01-10",
      type: "income",
      bankName: "給与",
      amountYen: 200000,
      recordType: "expenseEntry",
    });
  });
});

describe("mapReceiptToIncomeListEntry", () => {
  it("レシートを income list entry へ変換する", () => {
    expect(
      mapReceiptToIncomeListEntry({
        _id: "r1",
        date: "2024-01-10",
        bankName: "給与",
        amountYen: 200000,
      }),
    ).toEqual({
      _id: "r1",
      date: "2024-01-10",
      type: "income",
      bankName: "給与",
      amountYen: 200000,
      recordType: "receipt",
    });
  });
});

describe("addLegacyReceiptGroups", () => {
  it("レシートグループ ID・店舗名・合計金額を spending entry へ追加する", () => {
    const entries = [
      {
        _id: "r1",
        date: "2024-01-10",
        amountYen: 1000,
        categoryId: "cat-1",
        recordType: "receipt" as const,
        shopName: "スーパー",
      },
    ];
    expect(addLegacyReceiptGroups(entries)).toEqual([
      {
        _id: "r1",
        date: "2024-01-10",
        amountYen: 1000,
        categoryId: "cat-1",
        recordType: "receipt",
        shopName: "スーパー",
        receiptGroupId: "receipt:r1",
        receiptShopName: "スーパー",
        receiptTotalAmountYen: 1000,
      },
    ]);
  });
});

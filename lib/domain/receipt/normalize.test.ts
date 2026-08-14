import { describe, expect, it } from "vitest";
import {
  normalizeCreateReceiptArgs,
  normalizeUpdateReceiptPatch,
  type CreateReceiptInput,
} from "./normalize";

const categoryId = "cat-1";

describe("normalizeCreateReceiptArgs", () => {
  it("支出レシートを正規化する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-08-07",
      shopName: "  コンビニ  ",
      amountYen: 1000,
      categoryId,
    };
    const result = normalizeCreateReceiptArgs(input);
    expect(result.shopName).toBe("コンビニ");
    expect(result.amountYen).toBe(1000);
    expect(result.date).toBe("2026-08-07");
    expect(result.memo).toBeUndefined();
  });

  it("収入レシートを正規化する", () => {
    const input: CreateReceiptInput<string> = {
      type: "income",
      date: "2026-08-07",
      bankName: "  銀行  ",
      amountYen: 5000,
      categoryId,
    };
    const result = normalizeCreateReceiptArgs(input);
    expect(result.bankName).toBe("銀行");
    expect(result.shopName).toBeUndefined();
  });

  it("無効な日付を拒否する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-02-30",
      shopName: "コンビニ",
      amountYen: 1000,
      categoryId,
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow(
      "Date must be a valid YYYY-MM-DD value",
    );
  });

  it("非整数金額を拒否する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-08-07",
      shopName: "コンビニ",
      amountYen: 1000.5,
      categoryId,
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow("Amount must be a positive integer");
  });

  it("空の店舗名を拒否する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-08-07",
      shopName: "",
      amountYen: 1000,
      categoryId,
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow("shopName is required");
  });

  it("長すぎる店舗名を拒否する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-08-07",
      shopName: "a".repeat(101),
      amountYen: 1000,
      categoryId,
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow(
      "shopName must be 100 characters or fewer",
    );
  });

  it("空の銀行名を拒否する", () => {
    const input: CreateReceiptInput<string> = {
      type: "income",
      date: "2026-08-07",
      bankName: "",
      amountYen: 1000,
      categoryId,
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow("bankName is required");
  });

  it("長すぎるメモを拒否する", () => {
    const input: CreateReceiptInput<string> = {
      date: "2026-08-07",
      shopName: "コンビニ",
      amountYen: 1000,
      categoryId,
      memo: "a".repeat(501),
    };
    expect(() => normalizeCreateReceiptArgs(input)).toThrow("Memo must be 500 characters or less");
  });
});

describe("normalizeUpdateReceiptPatch", () => {
  it("日付と店舗名を更新する", () => {
    const result = normalizeUpdateReceiptPatch({
      date: "2026-08-08",
      shopName: "  スーパー  ",
    });
    expect(result.date).toBe("2026-08-08");
    expect(result.shopName).toBe("スーパー");
  });

  it("空の shopName を拒否する", () => {
    expect(() => normalizeUpdateReceiptPatch({ shopName: "" })).toThrow(
      "shopName must be 100 characters or fewer",
    );
  });

  it("空文字 memo を undefined として返す", () => {
    const result = normalizeUpdateReceiptPatch({ memo: "" });
    expect(result.memo).toBeUndefined();
  });
});

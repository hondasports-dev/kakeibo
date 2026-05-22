import { describe, expect, it } from "vitest";
import { validateReceiptForm } from "./receipt";

describe("validateReceiptForm", () => {
  const validInput = {
    date: "2026-05-12",
    shopName: "スーパー北浜",
    amountYen: "4280",
    categoryId: "abc123",
    memo: "特売日",
  };

  it("全フィールド正常 → success: true", () => {
    const result = validateReceiptForm(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2026-05-12");
      expect(result.data.shopName).toBe("スーパー北浜");
      expect(result.data.amountYen).toBe(4280);
      expect(result.data.categoryId).toBe("abc123");
      expect(result.data.memo).toBe("特売日");
    }
  });

  it("memo なし（optional）→ success: true", () => {
    const { memo: _memo, ...withoutMemo } = validInput; // eslint-disable-line @typescript-eslint/no-unused-vars
    const result = validateReceiptForm(withoutMemo);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memo).toBeUndefined();
    }
  });

  it("date 空 → success: false, errors.date あり", () => {
    const result = validateReceiptForm({ ...validInput, date: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.date).toBeDefined();
    }
  });

  it("shopName 空 → success: false, errors.shopName あり", () => {
    const result = validateReceiptForm({ ...validInput, shopName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.shopName).toBeDefined();
    }
  });

  it("amountYen 空 → success: false, errors.amountYen あり", () => {
    const result = validateReceiptForm({ ...validInput, amountYen: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeDefined();
    }
  });

  it("categoryId 空 → success: false, errors.categoryId あり", () => {
    const result = validateReceiptForm({ ...validInput, categoryId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.categoryId).toBeDefined();
    }
  });

  it('amountYen が "abc" → success: false, errors.amountYen あり', () => {
    const result = validateReceiptForm({ ...validInput, amountYen: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeDefined();
      expect(result.errors.amountYen).toBe("金額は数字のみで入力してください");
    }
  });

  it('amountYen が "0" → success: false（1円以上）', () => {
    const result = validateReceiptForm({ ...validInput, amountYen: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeDefined();
      expect(result.errors.amountYen).toBe("金額は 1 円以上です");
    }
  });

  it('amountYen が "10000000" → success: false（9999999以下）', () => {
    const result = validateReceiptForm({ ...validInput, amountYen: "10000000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.amountYen).toBeDefined();
      expect(result.errors.amountYen).toBe("金額は 9,999,999 円以下です");
    }
  });

  it('date が "2026/05/12" 形式 → success: false', () => {
    const result = validateReceiptForm({ ...validInput, date: "2026/05/12" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.date).toBeDefined();
      expect(result.errors.date).toBe("YYYY-MM-DD 形式で入力してください");
    }
  });

  it("shopName が 100 文字を超える → success: false", () => {
    const result = validateReceiptForm({ ...validInput, shopName: "あ".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.shopName).toBeDefined();
      expect(result.errors.shopName).toBe("店舗名は 100 文字以内です");
    }
  });

  it("memo が 500 文字を超える → success: false", () => {
    const result = validateReceiptForm({ ...validInput, memo: "あ".repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.memo).toBeDefined();
      expect(result.errors.memo).toBe("メモは 500 文字以内です");
    }
  });

  it('date が "2026-02-30"（存在しない日付）→ success: false', () => {
    const result = validateReceiptForm({ ...validInput, date: "2026-02-30" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.date).toBeDefined();
      expect(result.errors.date).toBe("存在しない日付です");
    }
  });

  it("memo が空文字列 → success: true、data.memo は undefined", () => {
    const result = validateReceiptForm({ ...validInput, memo: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memo).toBeUndefined();
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  validateExtractedIsoDate,
  validateReceiptShopName,
  validateReceiptTotalAmount,
} from "./receiptExtraction";

describe("validateReceiptShopName", () => {
  it.each(["スーパー", "  スーパー ABC  "])("%s を trim して有効な店舗名とする", (value) => {
    expect(validateReceiptShopName(value)).toEqual({ success: true, shopName: value.trim() });
  });

  it.each(["", "   ", "a".repeat(101)])("%s は無効な店舗名", (value) => {
    const result = validateReceiptShopName(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(["empty", "too_long"]).toContain(result.error);
    }
  });
});

describe("validateExtractedIsoDate", () => {
  it.each(["", "2024-03-15"])("%s は有効（空許容）", (value) => {
    expect(validateExtractedIsoDate(value)).toEqual({ success: true, date: value });
  });

  it.each(["2024-02-30", "2024/03/15", "2024-3-15"])("%s は無効な ISO 日付", (value) => {
    const result = validateExtractedIsoDate(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("invalid");
    }
  });
});

describe("validateReceiptTotalAmount", () => {
  it.each([1, 9999999])("%s 円は有効な合計金額", (amount) => {
    expect(validateReceiptTotalAmount(amount)).toEqual({ success: true, amount });
  });

  it.each([0, -1, 1.5, 10000000, Number.NaN])("%s は無効な合計金額", (amount) => {
    const result = validateReceiptTotalAmount(amount);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(["not_positive_integer", "too_large"]).toContain(result.error);
    }
  });
});

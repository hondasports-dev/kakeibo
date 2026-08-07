import { describe, expect, it } from "vitest";
import { normalizeReceiptDate } from "./receiptDate";

describe("normalizeReceiptDate", () => {
  it.each([
    ["2024-03-15", "2024-03-15"],
    ["2024/3/15", "2024-03-15"],
    ["2024年3月15日", "2024-03-15"],
    ["  2024-03-15  ", "2024-03-15"],
    ["2024-03-15\u3000", "2024-03-15"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeReceiptDate(input)).toEqual({ success: true, date: expected });
  });

  it.each(["2024-02-30", "2024-13-01", "abc"])("%s は無効な日付", (input) => {
    const result = normalizeReceiptDate(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(["invalid", "no_candidate", "ambiguous", "range_expression"]).toContain(result.error);
    }
  });

  it("範囲表現を拒否する", () => {
    const result = normalizeReceiptDate("2024-03-15〜2024-03-20");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("range_expression");
    }
  });

  it("候補が曖昧なら拒否する", () => {
    const result = normalizeReceiptDate("2024-03-15, 2024-03-16");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("ambiguous");
    }
  });

  it("空文字は無効", () => {
    const result = normalizeReceiptDate("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("no_candidate");
    }
  });
});

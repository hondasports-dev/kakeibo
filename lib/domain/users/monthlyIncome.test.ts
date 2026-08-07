import { describe, expect, it } from "vitest";
import { validateMonthlyIncome } from "./monthlyIncome";

describe("validateMonthlyIncome", () => {
  it.each([0, 1, 9999999, 100000000])("%s 円は有効な月収入", (income) => {
    expect(validateMonthlyIncome(income)).toEqual({ success: true, monthlyIncome: income });
  });

  it.each([-1, 1.5, Number.NaN])("%s は有効な月収入ではない", (income) => {
    const result = validateMonthlyIncome(income);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("invalid");
    }
  });
});

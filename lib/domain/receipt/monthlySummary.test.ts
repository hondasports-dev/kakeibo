import { describe, expect, it } from "vitest";
import { summarizeMonthlyExpenses } from "./monthlySummary";

describe("summarizeMonthlyExpenses", () => {
  it("支出合計と残高を計算する", () => {
    const result = summarizeMonthlyExpenses([{ amountYen: 1000 }, { amountYen: 2500 }], 500000);
    expect(result).toEqual({
      totalExpensesYen: 3500,
      monthlyIncome: 500000,
      remainingBalanceYen: 496500,
    });
  });

  it("月収入が未設定の場合は残高も null", () => {
    const result = summarizeMonthlyExpenses([{ amountYen: 1000 }], null);
    expect(result).toEqual({
      totalExpensesYen: 1000,
      monthlyIncome: null,
      remainingBalanceYen: null,
    });
  });

  it("支出が空の場合は 0", () => {
    const result = summarizeMonthlyExpenses([], 300000);
    expect(result).toEqual({
      totalExpensesYen: 0,
      monthlyIncome: 300000,
      remainingBalanceYen: 300000,
    });
  });
});

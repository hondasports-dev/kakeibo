export type MonthlyExpensesSummary = {
  totalExpensesYen: number;
  monthlyIncome: number | null;
  remainingBalanceYen: number | null;
};

export type SpendingEntryLike = {
  amountYen: number;
};

export function summarizeMonthlyExpenses(
  spendingEntries: SpendingEntryLike[],
  monthlyIncome: number | null | undefined,
): MonthlyExpensesSummary {
  const totalExpensesYen = spendingEntries.reduce((sum, entry) => sum + entry.amountYen, 0);
  const income = monthlyIncome ?? null;
  const remainingBalanceYen = income !== null ? income - totalExpensesYen : null;

  return {
    totalExpensesYen,
    monthlyIncome: income,
    remainingBalanceYen,
  };
}

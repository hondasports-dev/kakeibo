/** 月収入の純粋ドメインルール。 */
export type MonthlyIncomeError = "invalid";

export function validateMonthlyIncome(
  monthlyIncome: number,
): { success: true; monthlyIncome: number } | { success: false; error: MonthlyIncomeError } {
  if (
    typeof monthlyIncome !== "number" ||
    Number.isNaN(monthlyIncome) ||
    !Number.isInteger(monthlyIncome) ||
    monthlyIncome < 0
  ) {
    return { success: false, error: "invalid" };
  }
  return { success: true, monthlyIncome };
}

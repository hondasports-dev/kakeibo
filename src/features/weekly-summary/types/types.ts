import type { WeeklyExpenseChartData } from "../utils/weeklyExpenseChartData";

export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmountYen: number;
  count: number;
};

export type ReceiptItem = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  memo?: string;
  recordType: "expenseEntry" | "receipt";
};

export type IncomeItem = {
  _id: string;
  date: string;
  type: "income";
  bankName?: string;
  amountYen: number;
  memo?: string;
  recordType: "expenseEntry" | "receipt";
};

export function incomeItemToReceiptItem(income: IncomeItem): ReceiptItem {
  return {
    _id: income._id,
    date: income.date,
    type: "income",
    bankName: income.bankName,
    amountYen: income.amountYen,
    memo: income.memo,
    recordType: income.recordType,
    categoryId: "",
    categoryName: "",
    categoryColor: "#AAB7C4",
  };
}

export type WeeklySummaryPanelProps = {
  count: number;
  totalAmountYen: number;
  totalIncomeYen?: number;
  incomeCount?: number;
  byCategory: CategorySummary[];
  prevWeekTotalAmountYen: number | null;
  receipts: ReceiptItem[];
  incomes?: IncomeItem[];
  isLoading?: boolean;
  weekStartDate: string;
  weeklyExpenseTrend?: WeeklyExpenseChartData | null;
  onDeleteReceipt?: (receipt: ReceiptItem) => void;
  onEditReceipt?: (receipt: ReceiptItem) => void;
};

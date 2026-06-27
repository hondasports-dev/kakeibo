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

export type WeeklySummaryPanelProps = {
  count: number;
  totalAmountYen: number;
  byCategory: CategorySummary[];
  prevWeekTotalAmountYen: number | null;
  receipts: ReceiptItem[];
  isLoading?: boolean;
  weekStartDate: string;
  weeklyExpenseTrend?: WeeklyExpenseChartData | null;
  onDeleteReceipt?: (receipt: ReceiptItem) => void;
  onEditReceipt?: (receipt: ReceiptItem) => void;
};

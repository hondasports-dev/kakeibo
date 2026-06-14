import type { DailySpendingTrendData } from "../../../convex/receipts";

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
};

export type WeeklySummaryPanelProps = {
  count: number;
  totalAmountYen: number;
  byCategory: CategorySummary[];
  prevWeekTotalAmountYen: number | null;
  receipts: ReceiptItem[];
  prevWeekReceipts?: ReceiptItem[];
  isLoading?: boolean;
  weekStartDate: string;
  dailySpendingTrend?: DailySpendingTrendData | null;
};

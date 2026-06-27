import { Stack } from "@mui/material";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard";
import { ReceiptListCard } from "./ReceiptListCard";
import { TotalSummaryCard } from "./TotalSummaryCard";
import type { WeeklySummaryPanelProps } from "../types/types";

export function WeeklySummaryPanel({
  count,
  totalAmountYen,
  byCategory,
  prevWeekTotalAmountYen,
  receipts,
  isLoading = false,
  weeklyExpenseTrend,
  onDeleteReceipt,
  onEditReceipt,
}: WeeklySummaryPanelProps) {
  return (
    <Stack spacing={2.5}>
      <TotalSummaryCard
        isLoading={isLoading}
        prevWeekTotalAmountYen={prevWeekTotalAmountYen}
        totalAmountYen={totalAmountYen}
      />

      {weeklyExpenseTrend !== null && (
        <WeeklyTrendChart
          chartData={weeklyExpenseTrend}
          isLoading={weeklyExpenseTrend === undefined}
        />
      )}

      <CategoryBreakdownCard
        byCategory={byCategory}
        count={count}
        isLoading={isLoading}
        totalAmountYen={totalAmountYen}
      />

      <ReceiptListCard
        count={count}
        isLoading={isLoading}
        receipts={receipts}
        onDeleteReceipt={onDeleteReceipt}
        onEditReceipt={onEditReceipt}
      />
    </Stack>
  );
}

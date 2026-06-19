import { Stack } from "@mui/material";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard";
import { DailyComparisonDialog } from "./DailyComparisonDialog";
import { ReceiptListCard } from "./ReceiptListCard";
import { TotalSummaryCard } from "./TotalSummaryCard";
import { useDailyComparison } from "../hooks/useDailyComparison";
import type { WeeklySummaryPanelProps } from "../types/types";

export function WeeklySummaryPanel({
  count,
  totalAmountYen,
  byCategory,
  prevWeekTotalAmountYen,
  receipts,
  prevWeekReceipts = [],
  isLoading = false,
  weekStartDate,
  dailySpendingTrend,
}: WeeklySummaryPanelProps) {
  const comparison = useDailyComparison({ prevWeekReceipts, receipts, weekStartDate });

  return (
    <Stack spacing={2.5}>
      <TotalSummaryCard
        isLoading={isLoading}
        prevWeekTotalAmountYen={prevWeekTotalAmountYen}
        totalAmountYen={totalAmountYen}
      />

      {dailySpendingTrend !== null && (
        <WeeklyTrendChart
          currentWeek={dailySpendingTrend?.currentWeek}
          previousWeek={dailySpendingTrend?.previousWeek}
          isLoading={dailySpendingTrend === undefined}
          onPointClick={comparison.handlePointClick}
        />
      )}

      <CategoryBreakdownCard
        byCategory={byCategory}
        count={count}
        isLoading={isLoading}
        totalAmountYen={totalAmountYen}
      />

      <ReceiptListCard count={count} isLoading={isLoading} receipts={receipts} />

      <DailyComparisonDialog
        currentDayReceipts={comparison.currentDayReceipts}
        currentDayTotal={comparison.currentDayTotal}
        dialogOpen={comparison.dialogOpen}
        onClose={comparison.handleClose}
        previousDate={comparison.previousDate}
        previousDayReceipts={comparison.previousDayReceipts}
        previousDayTotal={comparison.previousDayTotal}
        selectedDate={comparison.selectedDate}
      />
    </Stack>
  );
}

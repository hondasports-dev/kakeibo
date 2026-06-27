import { Box, Stack } from "@mui/material";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { ReceiptListCard } from "./ReceiptListCard";
import { SummaryMetricsPanel } from "./SummaryMetricsPanel";
import { WeeklyCategoryBreakdown } from "./WeeklyCategoryBreakdown";
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
  weekStartDate,
}: WeeklySummaryPanelProps) {
  const targetWeek = weeklyExpenseTrend?.items.at(-1);
  const previousDiff =
    targetWeek?.previousDiff ??
    (prevWeekTotalAmountYen === null ? null : totalAmountYen - prevWeekTotalAmountYen);

  return (
    <Stack spacing={2.5}>
      <SummaryMetricsPanel
        averageRate={targetWeek?.averageRate ?? null}
        isLoading={isLoading || weeklyExpenseTrend === undefined}
        previousDiff={previousDiff}
        totalAmountYen={totalAmountYen}
      />

      <Box className="weekly-summary-analysis-grid">
        {weeklyExpenseTrend !== null && (
          <WeeklyTrendChart
            chartData={weeklyExpenseTrend}
            isLoading={weeklyExpenseTrend === undefined}
          />
        )}
        <WeeklyCategoryBreakdown
          byCategory={byCategory}
          count={count}
          isLoading={isLoading}
          totalAmountYen={totalAmountYen}
        />
      </Box>

      <ReceiptListCard
        key={weekStartDate}
        count={count}
        isLoading={isLoading}
        receipts={receipts}
        onDeleteReceipt={onDeleteReceipt}
        onEditReceipt={onEditReceipt}
      />
    </Stack>
  );
}

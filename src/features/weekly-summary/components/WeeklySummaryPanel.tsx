import { Box, Stack } from "@mui/material";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { ReceiptListCard } from "./ReceiptListCard";
import { IncomeListCard } from "./IncomeListCard";
import { SummaryMetricsPanel } from "./SummaryMetricsPanel";
import { WeeklyCategoryBreakdown } from "./WeeklyCategoryBreakdown";
import type { WeeklySummaryPanelProps } from "../types/types";
import { incomeItemToReceiptItem } from "../types/types";

export function WeeklySummaryPanel({
  count,
  totalAmountYen,
  totalIncomeYen = 0,
  incomeCount = 0,
  byCategory,
  prevWeekTotalAmountYen,
  receipts,
  incomes = [],
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
        totalIncomeYen={totalIncomeYen}
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
        key={`expense-${weekStartDate}`}
        count={count}
        isLoading={isLoading}
        receipts={receipts}
        onDeleteReceipt={onDeleteReceipt}
        onEditReceipt={onEditReceipt}
      />

      <IncomeListCard
        key={`income-${weekStartDate}`}
        count={incomeCount}
        incomes={incomes}
        isLoading={isLoading}
        onDeleteIncome={
          onDeleteReceipt ? (income) => onDeleteReceipt(incomeItemToReceiptItem(income)) : undefined
        }
        onEditIncome={
          onEditReceipt ? (income) => onEditReceipt(incomeItemToReceiptItem(income)) : undefined
        }
      />
    </Stack>
  );
}

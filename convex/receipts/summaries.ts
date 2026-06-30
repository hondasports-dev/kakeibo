import { query } from "../_generated/server";
import { v } from "convex/values";

export {
  buildCategoryInfoMap,
  summarizeByCategory,
  summarizeReceipts,
  type CategorySummary,
} from "../../lib/convex/receipts/summaryLib/categoryAggregation";
export {
  getFourWeeksSummaryHandler,
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  type FourWeeksSummaryData,
  type WeekSummaryWithCategories,
} from "../../lib/convex/receipts/summaryLib/week";
export {
  getDailySpendingTrendHandler,
  type DailySpendingTrendData,
} from "../../lib/convex/receipts/summaryLib/trend";
export {
  getMonthlyExpensesSummaryHandler,
  type MonthlyExpensesSummary,
} from "../../lib/convex/receipts/summaryLib/monthly";

import {
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  getFourWeeksSummaryHandler,
} from "../../lib/convex/receipts/summaryLib/week";
import { getDailySpendingTrendHandler } from "../../lib/convex/receipts/summaryLib/trend";
import { getMonthlyExpensesSummaryHandler } from "../../lib/convex/receipts/summaryLib/monthly";

export const getWeekSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryHandler,
});

export const getWeekSummaryWithCategories = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryWithCategoriesHandler,
});

export const getFourWeeksSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getFourWeeksSummaryHandler,
});

export const getDailySpendingTrend = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getDailySpendingTrendHandler,
});

export const getMonthlyExpensesSummary = query({
  args: {
    monthStartDate: v.string(),
  },
  handler: getMonthlyExpensesSummaryHandler,
});

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
  getMonthSummaryWithCategoriesHandler,
  type MonthlyExpensesSummary,
  type MonthlySummaryWithCategories,
} from "../../lib/convex/receipts/summaryLib/monthly";

import {
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  getFourWeeksSummaryHandler,
} from "../../lib/convex/receipts/summaryLib/week";
import { getDailySpendingTrendHandler } from "../../lib/convex/receipts/summaryLib/trend";
import {
  getMonthlyExpensesSummaryHandler,
  getMonthSummaryWithCategoriesHandler,
} from "../../lib/convex/receipts/summaryLib/monthly";

export const getWeekSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryHandler,
});

const incomeListEntryValidator = v.object({
  _id: v.string(),
  date: v.string(),
  type: v.literal("income"),
  bankName: v.optional(v.string()),
  amountYen: v.number(),
  memo: v.optional(v.string()),
  recordType: v.union(v.literal("expenseEntry"), v.literal("receipt")),
});

const receiptWithCategoryValidator = v.object({
  _id: v.string(),
  date: v.string(),
  type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
  shopName: v.optional(v.string()),
  bankName: v.optional(v.string()),
  amountYen: v.number(),
  categoryId: v.string(),
  categoryName: v.string(),
  categoryColor: v.string(),
  memo: v.optional(v.string()),
  recordType: v.union(v.literal("expenseEntry"), v.literal("receipt")),
  itemName: v.optional(v.string()),
  receiptGroupId: v.optional(v.string()),
  receiptShopName: v.optional(v.string()),
  receiptTotalAmountYen: v.optional(v.number()),
});

const categorySummaryValidator = v.object({
  categoryId: v.string(),
  categoryName: v.string(),
  categoryColor: v.string(),
  totalAmountYen: v.number(),
  count: v.number(),
});

const monthlySummaryWithCategoriesValidator = v.object({
  count: v.number(),
  totalAmountYen: v.number(),
  totalIncomeYen: v.number(),
  netAmountYen: v.number(),
  incomeCount: v.number(),
  byCategory: v.array(categorySummaryValidator),
  receipts: v.array(receiptWithCategoryValidator),
  incomes: v.array(incomeListEntryValidator),
});

export const getWeekSummaryWithCategories = query({
  args: {
    weekStartDate: v.string(),
  },
  returns: v.object({
    count: v.number(),
    totalAmountYen: v.number(),
    totalIncomeYen: v.number(),
    incomeCount: v.number(),
    byCategory: v.array(categorySummaryValidator),
    prevWeekReceiptCount: v.number(),
    prevWeekTotalAmountYen: v.union(v.number(), v.null()),
    receipts: v.array(receiptWithCategoryValidator),
    incomes: v.array(incomeListEntryValidator),
  }),
  handler: getWeekSummaryWithCategoriesHandler,
});

export const getMonthSummaryWithCategories = query({
  args: {
    month: v.string(),
  },
  returns: monthlySummaryWithCategoriesValidator,
  handler: getMonthSummaryWithCategoriesHandler,
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

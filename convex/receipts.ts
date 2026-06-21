import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export { insertReceiptForGroup } from "./receipts/crud";
export type { CreateReceiptArgs } from "./receipts/crud";

export {
  createReceiptHandler,
  getReceiptsByWeekHandler,
  getReceiptsByDateHandler,
  updateReceiptHandler,
  deleteReceiptHandler,
  deleteReceiptsByUserHandler,
} from "./receipts/crud";

export type {
  WeekSummaryWithCategories,
  FourWeeksSummaryData,
  DailySpendingTrendData,
  MonthlyExpensesSummary,
} from "./receipts/summaries";

export {
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  getFourWeeksSummaryHandler,
  getDailySpendingTrendHandler,
  getMonthlyExpensesSummaryHandler,
} from "./receipts/summaries";

import {
  createReceiptHandler,
  getReceiptsByWeekHandler,
  getReceiptsByDateHandler,
  updateReceiptHandler,
  deleteReceiptHandler,
  deleteReceiptsByUserHandler,
} from "./receipts/crud";
import {
  getWeekSummaryHandler,
  getWeekSummaryWithCategoriesHandler,
  getFourWeeksSummaryHandler,
  getDailySpendingTrendHandler,
  getMonthlyExpensesSummaryHandler,
} from "./receipts/summaries";

export const createReceipt = mutation({
  args: {
    date: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    shopName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    memo: v.optional(v.string()),
  },
  handler: createReceiptHandler,
});

export const getReceiptsByWeek = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getReceiptsByWeekHandler,
});

export const getReceiptsByDate = query({
  args: {
    date: v.string(),
  },
  handler: getReceiptsByDateHandler,
});

export const updateReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    date: v.optional(v.string()),
    shopName: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    memo: v.optional(v.string()),
  },
  handler: updateReceiptHandler,
});

export const deleteReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: deleteReceiptHandler,
});

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

/**
 * 指定ユーザーのレシートを全件削除する。
 *
 * この mutation は internalMutation として定義されており、外部クライアントから
 * 直接呼び出せない。E2E テスト用の HTTP エンドポイント（convex/http.ts）経由でのみ呼び出す。
 */
export const deleteReceiptsByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: deleteReceiptsByUserHandler,
});

export const getMonthlyExpensesSummary = query({
  args: {
    monthStartDate: v.string(),
  },
  handler: getMonthlyExpensesSummaryHandler,
});

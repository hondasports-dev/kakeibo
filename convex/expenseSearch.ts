import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { searchExpensesHandler } from "../lib/convex/expenseSearch/searchExpenses";

const expenseSearchReceiptValidator = v.object({
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

export const searchExpenses = query({
  args: {
    shopQuery: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    minAmountYen: v.optional(v.number()),
    maxAmountYen: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(expenseSearchReceiptValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    truncated: v.boolean(),
    matchedGroupCount: v.number(),
  }),
  handler: searchExpensesHandler,
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    displayName: v.string(),
    email: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),

  receipts: defineTable({
    userId: v.string(),
    date: v.string(),
    shopName: v.string(),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    memo: v.string(),
    weekStartDate: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_week_start_date", ["userId", "weekStartDate"])
    .index("by_user_id_and_date", ["userId", "date"])
    .index("by_user_id_and_shop_name", ["userId", "shopName"]),

  weekSessions: defineTable({
    userId: v.string(),
    weekStartDate: v.string(),
    weekEndDate: v.string(),
    budgetAmountYen: v.number(),
    reviewMemo: v.string(),
    status: v.union(v.literal("draft"), v.literal("completed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id_and_week_start_date", ["userId", "weekStartDate"]),

  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id_and_is_active_and_sort_order", [
    "userId",
    "isActive",
    "sortOrder",
  ]),
});

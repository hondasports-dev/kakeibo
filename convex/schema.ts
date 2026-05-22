import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // userId には Clerk の tokenIdentifier を格納する。
    // 認可キーとして使用し、email は表示・補助用途に限定する。
    userId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // by_token_identifier: userId フィールド（= Clerk の tokenIdentifier の値）で引く専用インデックス。
    // Issue #8 要件: users には by_token_identifier index を定義する。
    // 旧 by_user_id インデックスはこのインデックスに一本化した。
    .index("by_token_identifier", ["userId"]),

  receipts: defineTable({
    userId: v.string(),
    date: v.string(),
    shopName: v.string(),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    // memo は任意入力のため optional とする。
    memo: v.optional(v.string()),
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
    // budgetAmountYen は週次セッション作成時点では未設定でもよいため optional とする。
    budgetAmountYen: v.optional(v.number()),
    // reviewMemo は週次セッション完了時のみ入力するため optional とする。
    reviewMemo: v.optional(v.string()),
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
  })
    .index("by_user_id_and_is_active_and_sort_order", ["userId", "isActive", "sortOrder"])
    .index("by_user_id_and_sort_order", ["userId", "sortOrder"]),
});

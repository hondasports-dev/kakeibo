import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
  aiExpenseDraftSourceTypeValidator,
  aiExpenseDraftStatusValidator,
} from "./aiExpenseDraftsModel";

export default defineSchema({
  users: defineTable({
    // userId には Clerk の tokenIdentifier を格納する。
    // 認可キーとして使用し、email は表示・補助用途に限定する。
    userId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    // monthlyIncome は月収入（円）。未設定の場合は optional で保持しない。
    monthlyIncome: v.optional(v.number()),
    // 週の開始曜日（0=日曜, 1=月曜, ..., 6=土曜）。未設定の場合は月曜(1)をデフォルトとする。
    weeklyStartDay: v.optional(v.number()),
    // 週の終了曜日（0=日曜, 1=月曜, ..., 6=土曜）。未設定の場合は日曜(0)をデフォルトとする。
    weeklyEndDay: v.optional(v.number()),
    // レシート画像を外部APIへ送信することへのユーザー承認時刻。
    receiptImageExternalApiConsentAcceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // by_token_identifier: userId フィールド（= Clerk の tokenIdentifier の値）で引く専用インデックス。
    // Issue #8 要件: users には by_token_identifier index を定義する。
    // 旧 by_user_id インデックスはこのインデックスに一本化した。
    .index("by_token_identifier", ["userId"]),

  sourceDocuments: defineTable({
    userId: v.string(),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("receipt"),
      v.literal("convenience_payment"),
      v.literal("invoice"),
      v.literal("unknown"),
    ),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("finalized")),
    date: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    shopName: v.optional(v.string()),
    paymentPlace: v.optional(v.string()),
    payeeName: v.optional(v.string()),
    paymentPurpose: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_status_and_created_at", ["userId", "status", "createdAt"])
    .index("by_user_id_and_date", ["userId", "date"]),

  expenseEntries: defineTable({
    userId: v.string(),
    sourceDocumentId: v.optional(v.id("sourceDocuments")),
    date: v.string(),
    amount: v.number(),
    categoryId: v.id("categories"),
    title: v.string(),
    memo: v.optional(v.string()),
    entryType: v.union(v.literal("expense"), v.literal("income")),
    source: v.union(v.literal("manual"), v.literal("ai_suggested"), v.literal("imported")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_date", ["userId", "date"])
    .index("by_user_id_and_category_id_and_date", ["userId", "categoryId", "date"])
    .index("by_user_id_and_source_document_id", ["userId", "sourceDocumentId"]),

  receipts: defineTable({
    userId: v.string(),
    date: v.string(),
    // type は支出(expense) / 収入(income) を区別する。既存レコードとの後方互換のため optional とする。
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    // shopName は支出の場合に使用する。後方互換のため optional とする。
    shopName: v.optional(v.string()),
    // bankName は収入の場合に使用する。
    bankName: v.optional(v.string()),
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

  aiExpenseDrafts: defineTable({
    userId: v.string(),
    sourceType: aiExpenseDraftSourceTypeValidator,
    status: aiExpenseDraftStatusValidator,
    documentType: aiExpenseDraftDocumentTypeValidator,
    // 既存の dev 下書きに残っている画像ファイル名。新規コードでは必須にしない。
    imageFileName: v.optional(v.string()),
    shopName: v.optional(v.string()),
    paymentPlace: v.optional(v.string()),
    payeeName: v.optional(v.string()),
    paymentPurpose: v.optional(v.string()),
    date: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    confidence: aiExpenseDraftConfidenceValidator,
    // 既存の dev 下書きには warnings が無いものがあるため optional とする。
    warnings: v.optional(v.array(v.string())),
    reviewReasons: v.array(aiExpenseDraftReviewReasonValidator),
    registeredReceiptId: v.optional(v.id("receipts")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_status_and_created_at", ["userId", "status", "createdAt"])
    .index("by_user_id_and_created_at", ["userId", "createdAt"])
    .index("by_user_id_and_registered_receipt_id", ["userId", "registeredReceiptId"]),

  aiExpenseDraftItems: defineTable({
    userId: v.string(),
    draftId: v.id("aiExpenseDrafts"),
    itemName: v.string(),
    amountYen: v.number(),
    categoryId: v.optional(v.id("categories")),
    confidence: aiExpenseDraftItemConfidenceValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_draft_id", ["draftId"])
    .index("by_user_id_and_draft_id", ["userId", "draftId"]),

  receiptAnalysisBatches: defineTable({
    userId: v.string(),
    totalCount: v.number(),
    processedCount: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("partially_failed"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id_and_status", ["userId", "status"])
    .index("by_user_id_and_created_at", ["userId", "createdAt"]),

  receiptAnalysisImageJobs: defineTable({
    batchId: v.id("receiptAnalysisBatches"),
    userId: v.string(),
    imageIndex: v.number(),
    fileName: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("ready"),
      v.literal("needs_review"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    draftId: v.optional(v.id("aiExpenseDrafts")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batch_id", ["batchId"])
    .index("by_user_id_and_status", ["userId", "status", "createdAt"])
    .index("by_draft_id", ["draftId"]),
});

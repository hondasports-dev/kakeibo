import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
  aiExpenseDraftSourceTypeValidator,
  aiExpenseDraftStatusValidator,
} from "./aiExpenseDrafts/model";
import {
  managementAuditActionValidator,
  managementAuditTargetKindValidator,
} from "./groups/lib/managementAuditLogModel";

export default defineSchema({
  users: defineTable({
    // userId には Clerk の tokenIdentifier を格納する。
    // 認可キーとして使用し、email は表示・補助用途に限定する。
    userId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    activeGroupId: v.optional(v.id("groups")),
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
    .index("by_token_identifier", ["userId"])
    .index("by_email", ["email"]),

  // ---------------------------------------------------------------------------
  // グループ管理テーブル（Issue #103: 家族グループへのアクセス変更）
  // ---------------------------------------------------------------------------

  groups: defineTable({
    name: v.string(),
    clerkOrganizationId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("deleted"), v.literal("archived"))),
    deletedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    // userId には Clerk の tokenIdentifier を格納する。
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_group_id", ["groupId"])
    .index("by_group_id_and_user_id", ["groupId", "userId"]),

  groupInvitations: defineTable({
    groupId: v.id("groups"),
    email: v.string(),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    invitedByUserId: v.string(),
    clerkInvitationId: v.optional(v.string()),
    acceptedByUserId: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_group_id_and_email", ["groupId", "email"])
    .index("by_group_id_and_status", ["groupId", "status"]),

  managementAuditLogs: defineTable({
    groupId: v.id("groups"),
    actorUserId: v.string(),
    action: managementAuditActionValidator,
    targetKind: managementAuditTargetKindValidator,
    targetId: v.optional(v.string()),
    targetLabel: v.optional(v.string()),
    beforeValue: v.optional(v.string()),
    afterValue: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_group_id_and_created_at", ["groupId", "createdAt"]),

  // ---------------------------------------------------------------------------
  // データテーブル（userId → groupId に変更済み）
  // ---------------------------------------------------------------------------

  sourceDocuments: defineTable({
    groupId: v.id("groups"),
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
    .index("by_group_id_and_status_and_created_at", ["groupId", "status", "createdAt"])
    .index("by_group_id_and_date", ["groupId", "date"]),

  expenseEntries: defineTable({
    groupId: v.id("groups"),
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
    .index("by_group_id_and_date", ["groupId", "date"])
    .index("by_group_id_and_category_id_and_date", ["groupId", "categoryId", "date"])
    .index("by_group_id_and_source_document_id", ["groupId", "sourceDocumentId"]),

  receipts: defineTable({
    groupId: v.id("groups"),
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
    .index("by_group_id_and_week_start_date", ["groupId", "weekStartDate"])
    .index("by_group_id_and_date", ["groupId", "date"])
    .index("by_group_id_and_shop_name", ["groupId", "shopName"]),

  weekSessions: defineTable({
    groupId: v.id("groups"),
    weekStartDate: v.string(),
    weekEndDate: v.string(),
    // reviewMemo は週次セッション完了時のみ入力するため optional とする。
    reviewMemo: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("completed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_group_id_and_week_start_date", ["groupId", "weekStartDate"]),

  categories: defineTable({
    groupId: v.id("groups"),
    name: v.string(),
    color: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_group_id_and_is_active_and_sort_order", ["groupId", "isActive", "sortOrder"])
    .index("by_group_id_and_sort_order", ["groupId", "sortOrder"]),

  aiExpenseDrafts: defineTable({
    groupId: v.id("groups"),
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
    .index("by_group_id_and_status_and_created_at", ["groupId", "status", "createdAt"])
    .index("by_group_id_and_created_at", ["groupId", "createdAt"])
    .index("by_group_id_and_registered_receipt_id", ["groupId", "registeredReceiptId"]),

  aiExpenseDraftItems: defineTable({
    groupId: v.id("groups"),
    draftId: v.id("aiExpenseDrafts"),
    itemName: v.string(),
    amountYen: v.number(),
    categoryId: v.optional(v.id("categories")),
    confidence: aiExpenseDraftItemConfidenceValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_draft_id", ["draftId"])
    .index("by_group_id_and_draft_id", ["groupId", "draftId"]),

  receiptAnalysisBatches: defineTable({
    groupId: v.id("groups"),
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
    .index("by_group_id_and_status", ["groupId", "status"])
    .index("by_group_id_and_created_at", ["groupId", "createdAt"]),

  receiptAnalysisImageJobs: defineTable({
    batchId: v.id("receiptAnalysisBatches"),
    groupId: v.id("groups"),
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
    .index("by_group_id_and_status", ["groupId", "status", "createdAt"])
    .index("by_draft_id", ["draftId"]),
});

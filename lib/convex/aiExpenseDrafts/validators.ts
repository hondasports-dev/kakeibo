import { v } from "convex/values";

export const AI_EXPENSE_DRAFT_STATUSES = [
  "queued",
  "analyzing",
  "ready",
  "needs_review",
  "failed",
  "registered",
] as const;

export const AI_EXPENSE_DRAFT_SOURCE_TYPES = ["image_upload"] as const;

export const AI_EXPENSE_DRAFT_DOCUMENT_TYPES = [
  "receipt",
  "convenience_payment",
  "unknown",
] as const;

export const AI_EXPENSE_DRAFT_REVIEW_REASONS = [
  "low_confidence",
  "missing_required_field",
  "ambiguous_document_type",
  "ambiguous_category",
  "multiple_categories",
  "user_confirmation_required",
  "amount_mismatch",
  "parse_failed",
] as const;

export const AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD = 0.8;

export const aiExpenseDraftStatusValidator = v.union(
  v.literal("queued"),
  v.literal("analyzing"),
  v.literal("ready"),
  v.literal("needs_review"),
  v.literal("failed"),
  v.literal("registered"),
);

export const aiExpenseDraftSourceTypeValidator = v.union(v.literal("image_upload"));

export const aiExpenseDraftDocumentTypeValidator = v.union(
  v.literal("receipt"),
  v.literal("convenience_payment"),
  v.literal("unknown"),
);

export const aiExpenseDraftReviewReasonValidator = v.union(
  v.literal("low_confidence"),
  v.literal("missing_required_field"),
  v.literal("ambiguous_document_type"),
  v.literal("ambiguous_category"),
  v.literal("multiple_categories"),
  v.literal("user_confirmation_required"),
  v.literal("amount_mismatch"),
  v.literal("parse_failed"),
);

export const aiExpenseDraftConfidenceValidator = v.object({
  documentType: v.optional(v.number()),
  shopName: v.optional(v.number()),
  paymentPlace: v.optional(v.number()),
  payeeName: v.optional(v.number()),
  paymentPurpose: v.optional(v.number()),
  date: v.optional(v.number()),
  amountYen: v.optional(v.number()),
  categoryId: v.optional(v.number()),
});

export const aiExpenseDraftItemConfidenceValidator = v.object({
  itemName: v.optional(v.number()),
  amountYen: v.optional(v.number()),
  categoryName: v.optional(v.number()),
  categoryId: v.optional(v.number()),
});

export type AiExpenseDraftDocumentType = (typeof AI_EXPENSE_DRAFT_DOCUMENT_TYPES)[number];
export type AiExpenseDraftReviewReason = (typeof AI_EXPENSE_DRAFT_REVIEW_REASONS)[number];

export type AiExpenseDraftConfidence = {
  documentType?: number;
  shopName?: number;
  paymentPlace?: number;
  payeeName?: number;
  paymentPurpose?: number;
  date?: number;
  amountYen?: number;
  categoryId?: number;
};

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

type AiExpenseDraftClassificationInput = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: unknown;
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  items?: Array<{
    amountYen: number;
  }>;
};

type ReceiptShopNameDraftFields = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
};

function joinNonEmpty(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" ");
}

function hasText(value: string | undefined) {
  return value !== undefined && value.trim().length > 0;
}

function hasLowConfidence(
  confidence: AiExpenseDraftConfidence,
  fields: Array<keyof AiExpenseDraftConfidence>,
) {
  return fields.some((field) => {
    const score = confidence[field];
    return typeof score !== "number" || score < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD;
  });
}

function getMajorConfidenceFields(input: AiExpenseDraftClassificationInput) {
  const fields: Array<keyof AiExpenseDraftConfidence> = [];

  if (hasText(input.date)) {
    fields.push("date");
  }

  if (input.amountYen !== undefined && input.amountYen >= 1) {
    fields.push("amountYen");
  }

  if (input.categoryId !== undefined) {
    fields.push("categoryId");
  }

  if (input.documentType === "convenience_payment") {
    if (hasText(input.paymentPlace)) {
      fields.push("paymentPlace");
    }
    if (hasText(input.payeeName)) {
      fields.push("payeeName");
    }
    if (hasText(input.paymentPurpose)) {
      fields.push("paymentPurpose");
    }
    return fields;
  }

  if (input.documentType === "receipt") {
    if (hasText(input.shopName)) {
      fields.push("shopName");
    } else if (hasText(input.payeeName)) {
      fields.push("payeeName");
    } else if (hasText(input.paymentPlace)) {
      fields.push("paymentPlace");
    }
    return fields;
  }

  return fields;
}

function hasRequiredCounterparty(input: AiExpenseDraftClassificationInput) {
  if (input.documentType === "convenience_payment") {
    return hasText(input.payeeName) && hasText(input.paymentPurpose);
  }

  return hasText(input.shopName) || hasText(input.payeeName) || hasText(input.paymentPlace);
}

function hasAmountMismatch(input: AiExpenseDraftClassificationInput) {
  if (input.amountYen === undefined || input.items === undefined || input.items.length === 0) {
    return false;
  }

  const itemTotal = input.items.reduce((sum, item) => sum + item.amountYen, 0);
  return itemTotal !== input.amountYen;
}

function addReason(reasons: Set<AiExpenseDraftReviewReason>, reason: AiExpenseDraftReviewReason) {
  if (AI_EXPENSE_DRAFT_REVIEW_REASONS.includes(reason)) {
    reasons.add(reason);
  }
}

export function classifyAiExpenseDraft(input: AiExpenseDraftClassificationInput): {
  status: "ready" | "needs_review";
  reviewReasons: AiExpenseDraftReviewReason[];
} {
  const reasons = new Set<AiExpenseDraftReviewReason>();

  if (
    !hasText(input.date) ||
    input.amountYen === undefined ||
    input.amountYen < 1 ||
    !hasRequiredCounterparty(input)
  ) {
    addReason(reasons, "missing_required_field");
  }

  if (input.documentType === "unknown") {
    addReason(reasons, "ambiguous_document_type");
  }

  if (input.categoryId === undefined) {
    addReason(reasons, "ambiguous_category");
  }

  if (
    hasLowConfidence(input.confidence, getMajorConfidenceFields(input)) ||
    input.warnings.length > 0
  ) {
    addReason(reasons, "low_confidence");
  }

  if (hasAmountMismatch(input)) {
    addReason(reasons, "amount_mismatch");
  }

  const reviewReasons = AI_EXPENSE_DRAFT_REVIEW_REASONS.filter((reason) => reasons.has(reason));
  return {
    status: reviewReasons.length === 0 ? "ready" : "needs_review",
    reviewReasons,
  };
}

export function resolveReceiptShopNameFromDraft(draft: ReceiptShopNameDraftFields) {
  if (draft.documentType === "convenience_payment") {
    return (
      joinNonEmpty([draft.payeeName, draft.paymentPurpose]) ||
      draft.paymentPlace?.trim() ||
      draft.shopName?.trim() ||
      "不明"
    );
  }

  return draft.shopName?.trim() || draft.payeeName?.trim() || draft.paymentPlace?.trim() || "不明";
}

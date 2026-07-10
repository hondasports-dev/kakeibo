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

export const amountBasisValidator = v.union(
  v.literal("tax_included"),
  v.literal("tax_excluded"),
  v.literal("unknown"),
);
export const taxSummaryTaxRatePercentValidator = v.union(v.literal(0), v.literal(8), v.literal(10));
export const taxModeValidator = v.union(
  v.literal("external"),
  v.literal("included"),
  v.literal("mixed"),
  v.literal("unknown"),
);
export const receiptItemTaxRatePercentValidator = v.union(
  v.literal(0),
  v.literal(8),
  v.literal(10),
  v.null(),
);
export const receiptMarkersValidator = v.array(v.string());
export const taxResolutionStatusValidator = v.union(v.literal("resolved"), v.literal("unresolved"));
export const taxResolutionSourceValidator = v.union(
  v.literal("item_explicit"),
  v.literal("single_summary"),
  v.literal("summary_reconciliation"),
  v.literal("remaining_summary"),
  v.literal("marker_reconciled"),
  v.literal("paid_total_reconciliation"),
);
export const receiptMarkerDefinitionValidator = v.object({
  marker: v.string(),
  description: v.string(),
});
export const markerDefinitionsValidator = v.array(receiptMarkerDefinitionValidator);
export const taxSummaryValidator = v.object({
  taxRatePercent: taxSummaryTaxRatePercentValidator,
  taxMode: taxModeValidator,
  taxableAmountYen: v.number(),
  taxableAmountBasis: amountBasisValidator,
  taxYen: v.number(),
  taxIncludedAmountYen: v.optional(v.number()),
  roundingMethod: v.union(
    v.literal("floor"),
    v.literal("round"),
    v.literal("ceil"),
    v.literal("unknown"),
  ),
  confidence: v.object({
    taxRatePercent: v.optional(v.number()),
    taxMode: v.optional(v.number()),
    taxableAmountYen: v.optional(v.number()),
    taxableAmountBasis: v.optional(v.number()),
    taxYen: v.optional(v.number()),
  }),
  warnings: v.array(v.string()),
  status: v.optional(
    v.union(v.literal("coherent"), v.literal("reconcilable"), v.literal("conflicting")),
  ),
  reasons: v.optional(
    v.array(
      v.union(
        v.literal("included_mode_with_tax_excluded_basis"),
        v.literal("external_mode_with_tax_included_basis"),
        v.literal("tax_summary_amount_mismatch"),
        v.literal("tax_included_amount_mismatch"),
        v.literal("reconciled_to_included"),
        v.literal("reconciled_to_external"),
        v.literal("mixed_tax_mode"),
        v.literal("unresolved_tax_summary"),
      ),
    ),
  ),
});

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
  printedAmountYen: v.optional(v.number()),
  amountBasis: v.optional(v.number()),
  taxRatePercent: v.optional(v.number()),
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

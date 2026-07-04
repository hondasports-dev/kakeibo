import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  AI_EXPENSE_DRAFT_REVIEW_REASONS,
  classifyAiExpenseDraft,
  type AiExpenseDraftReviewReason,
} from "../../../convex/aiExpenseDrafts/model";
import { deriveTaxReviewReasons } from "../../receiptTax/draftTaxMapping";
import { reinterpretDraftTax } from "../../receiptTax/reinterpretDraftTax";
import type { AmountBasis } from "../../receiptTax/types";
import type { ReceiptItemTaxRatePercent } from "../receiptImageExtraction/types";

export type UpdateDraftItemTaxOverridesArgs = {
  draftId: Id<"aiExpenseDrafts">;
  itemId: Id<"aiExpenseDraftItems">;
  taxRatePercent?: ReceiptItemTaxRatePercent;
  amountBasis?: AmountBasis;
};

function mergeReviewReasons(
  computedReasons: AiExpenseDraftReviewReason[],
  existingReasons: AiExpenseDraftReviewReason[],
) {
  const reasons = new Set<AiExpenseDraftReviewReason>([...computedReasons, ...existingReasons]);
  return AI_EXPENSE_DRAFT_REVIEW_REASONS.filter((reason) => reasons.has(reason));
}

function nonTaxReviewReasons(reviewReasons: AiExpenseDraftReviewReason[]) {
  return reviewReasons.filter(
    (reason) => reason !== "user_confirmation_required" && reason !== "amount_mismatch",
  );
}

export async function updateDraftItemTaxOverridesHandler(
  ctx: MutationCtx,
  args: UpdateDraftItemTaxOverridesArgs,
  groupId: Id<"groups">,
) {
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft not found");
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  if (draft.status === "registered") {
    throw new ConvexError("Registered AI expense draft cannot be edited");
  }
  if (draft.status !== "needs_review" && draft.status !== "ready") {
    throw new ConvexError("Only needs_review or ready AI expense drafts can be edited");
  }
  if (draft.amountYen === undefined || !draft.taxSummaries || draft.taxSummaries.length === 0) {
    throw new ConvexError("Tax reinterpretation requires draft amount and tax summaries");
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .collect();

  const itemIndex = items.findIndex((item) => item._id === args.itemId);
  if (itemIndex < 0) {
    throw new ConvexError("AI expense draft item not found");
  }

  const { interpretation, itemFields } = reinterpretDraftTax({
    amountYen: draft.amountYen,
    taxSummaries: draft.taxSummaries,
    markerDefinitions: draft.markerDefinitions,
    items: items.map((item) => ({
      itemName: item.itemName,
      printedAmountYen: item.printedAmountYen,
      amountBasis: item.amountBasis,
      taxRatePercent: item.taxRatePercent ?? null,
      markers: item.markers,
      taxMarker: item.taxMarker,
      categoryName: item.categoryName,
      quantity: item.quantity,
      unitPriceYen: item.unitPriceYen,
      warnings: item.warnings,
    })),
    override: {
      itemIndex,
      taxRatePercent: args.taxRatePercent,
      amountBasis: args.amountBasis,
    },
  });

  const taxReviewReasons = deriveTaxReviewReasons(interpretation);
  const preservedReasons = nonTaxReviewReasons(draft.reviewReasons);
  const mergedTaxReasons = mergeReviewReasons(taxReviewReasons, preservedReasons);
  const classification = classifyAiExpenseDraft({
    documentType: draft.documentType,
    shopName: draft.shopName,
    paymentPlace: draft.paymentPlace,
    payeeName: draft.payeeName,
    paymentPurpose: draft.paymentPurpose,
    date: draft.date,
    amountYen: draft.amountYen,
    categoryId: draft.categoryId,
    confidence: draft.confidence,
    warnings: interpretation.warnings,
    items: items.map((item, index) => ({
      itemName: item.itemName,
      amountYen: itemFields[index]?.normalizedAmountYen ?? item.amountYen,
      categoryId: item.categoryId,
    })),
  });
  const reviewReasons = mergeReviewReasons(classification.reviewReasons, mergedTaxReasons);
  const status = reviewReasons.length === 0 ? "ready" : "needs_review";

  const now = Date.now();
  for (const [index, item] of items.entries()) {
    const fields = itemFields[index];
    if (!fields) {
      continue;
    }
    await ctx.db.patch(item._id, {
      amountYen: fields.normalizedAmountYen ?? item.amountYen,
      amountBasis: fields.amountBasis,
      taxRatePercent: fields.taxRatePercent,
      allocatedTaxYen: fields.allocatedTaxYen,
      normalizedAmountYen: fields.normalizedAmountYen,
      taxResolutionStatus: fields.taxResolutionStatus,
      taxResolutionSource: fields.taxResolutionSource,
      taxReviewReasons: fields.taxReviewReasons,
      warnings: fields.warnings,
      updatedAt: now,
    });
  }

  const nonInterpretationWarnings = (draft.warnings ?? []).filter(
    (warning) =>
      !warning.startsWith("unresolved_") &&
      !warning.startsWith("missing_tax_items:") &&
      warning !== "normalized_amount_mismatch" &&
      !warning.startsWith("taxable_amount_mismatch:") &&
      !warning.startsWith("duplicate_tax_summary:") &&
      !warning.startsWith("conflicting_tax_summary:"),
  );

  await ctx.db.patch(args.draftId, {
    status,
    taxSummaries: interpretation.taxSummaries,
    warnings: [...new Set([...nonInterpretationWarnings, ...interpretation.warnings])],
    reviewReasons,
    updatedAt: now,
  });

  const updatedDraft = await ctx.db.get(args.draftId);
  if (updatedDraft === null) {
    throw new ConvexError("Failed to retrieve updated AI expense draft");
  }

  const updatedItems = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .collect();

  return { draft: updatedDraft, items: updatedItems };
}

export type UpdateDraftItemTaxOverridesResult = {
  draft: Doc<"aiExpenseDrafts">;
  items: Doc<"aiExpenseDraftItems">[];
};

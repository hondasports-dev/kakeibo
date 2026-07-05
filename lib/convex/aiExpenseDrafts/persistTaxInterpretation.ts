import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  AI_EXPENSE_DRAFT_REVIEW_REASONS,
  classifyAiExpenseDraft,
  type AiExpenseDraftReviewReason,
} from "../../../convex/aiExpenseDrafts/model";
import {
  deriveTaxReviewReasons,
  isTaxInterpretationWarning,
  type DraftItemTaxFields,
} from "../../receiptTax/draftTaxMapping";
import {
  reinterpretDraftTax,
  type BulkUnresolvedTaxOverride,
  type DraftTaxOverride,
} from "../../receiptTax/reinterpretDraftTax";

export function mergeReviewReasons(
  computedReasons: AiExpenseDraftReviewReason[],
  existingReasons: AiExpenseDraftReviewReason[],
) {
  const reasons = new Set<AiExpenseDraftReviewReason>([...computedReasons, ...existingReasons]);
  return AI_EXPENSE_DRAFT_REVIEW_REASONS.filter((reason) => reasons.has(reason));
}

export function nonTaxReviewReasons(reviewReasons: AiExpenseDraftReviewReason[]) {
  return reviewReasons.filter(
    (reason) => reason !== "user_confirmation_required" && reason !== "amount_mismatch",
  );
}

function draftItemToTaxFields(item: Doc<"aiExpenseDraftItems">): DraftItemTaxFields {
  return {
    itemName: item.itemName,
    printedAmountYen: item.printedAmountYen ?? item.amountYen,
    amountBasis: item.amountBasis,
    taxRatePercent: item.taxRatePercent ?? null,
    markers: item.markers,
    taxMarker: item.taxMarker,
    categoryName: item.categoryName,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    warnings: item.warnings,
    taxResolutionStatus: item.taxResolutionStatus,
    taxResolutionSource: item.taxResolutionSource,
    taxReviewReasons: item.taxReviewReasons,
  };
}

export type PersistDraftTaxInterpretationArgs = {
  draftId: Id<"aiExpenseDrafts">;
  groupId: Id<"groups">;
  preservedNonTaxReasons?: AiExpenseDraftReviewReason[];
  override?: DraftTaxOverride;
  bulkUnresolvedOverride?: BulkUnresolvedTaxOverride;
};

export type PersistDraftTaxInterpretationResult = {
  draft: Doc<"aiExpenseDrafts">;
  items: Doc<"aiExpenseDraftItems">[];
};

export async function persistDraftTaxInterpretation(
  ctx: MutationCtx,
  args: PersistDraftTaxInterpretationArgs,
): Promise<PersistDraftTaxInterpretationResult> {
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft not found");
  }
  if (draft.groupId !== args.groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  if (draft.amountYen === undefined || !draft.taxSummaries || draft.taxSummaries.length === 0) {
    throw new ConvexError("Tax reinterpretation requires draft amount and tax summaries");
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", args.groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .collect();

  const { interpretation, itemFields } = reinterpretDraftTax({
    amountYen: draft.amountYen,
    taxSummaries: draft.taxSummaries,
    markerDefinitions: draft.markerDefinitions,
    items: items.map(draftItemToTaxFields),
    override: args.override,
    bulkUnresolvedOverride: args.bulkUnresolvedOverride,
  });

  const taxReviewReasons = deriveTaxReviewReasons(interpretation);
  const preservedReasons = args.preservedNonTaxReasons ?? nonTaxReviewReasons(draft.reviewReasons);
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
    multiCategoryConfirmed: true,
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
      printedAmountYen: fields.printedAmountYen ?? item.printedAmountYen ?? item.amountYen,
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
    (warning) => !isTaxInterpretationWarning(warning),
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
      q.eq("groupId", args.groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .collect();

  return { draft: updatedDraft, items: updatedItems };
}

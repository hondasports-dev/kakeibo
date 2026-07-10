import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import { classifyAiExpenseDraft } from "../../../convex/aiExpenseDrafts/model";
import { requireGroupMembership } from "../../../convex/groups/membership";
import {
  assertActiveCategoryBelongsToGroup,
  assertPositiveCategoryTotals,
  assertReviewUpdateCanBecomeReady,
  replaceDraftItemsForReview,
  trimOptional,
  type UpdateForReviewArgs,
} from "./reviewValidation";
import { nonTaxReviewReasons, persistDraftTaxInterpretation } from "./persistTaxInterpretation";

export async function updateForReviewHandler(ctx: MutationCtx, args: UpdateForReviewArgs) {
  const { groupId } = await requireGroupMembership(ctx);
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

  await assertActiveCategoryBelongsToGroup(ctx, args.categoryId, groupId);
  assertReviewUpdateCanBecomeReady(args);

  const now = Date.now();
  if (args.items !== undefined) {
    assertPositiveCategoryTotals(args.items);
    await replaceDraftItemsForReview(ctx, args.draftId, groupId, args.items, now);
  }

  const reviewConfidence = {
    ...draft.confidence,
    documentType: 1,
    shopName: trimOptional(args.shopName) ? 1 : draft.confidence.shopName,
    paymentPlace: trimOptional(args.paymentPlace) ? 1 : draft.confidence.paymentPlace,
    payeeName:
      trimOptional(args.payeeName) || trimOptional(args.shopName) ? 1 : draft.confidence.payeeName,
    paymentPurpose:
      trimOptional(args.paymentPurpose) || trimOptional(args.shopName)
        ? 1
        : draft.confidence.paymentPurpose,
    date: 1,
    amountYen: 1,
    categoryId: 1,
  };

  const classification = classifyAiExpenseDraft({
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName) ?? trimOptional(args.shopName),
    paymentPurpose: trimOptional(args.paymentPurpose) ?? trimOptional(args.shopName),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: reviewConfidence,
    warnings: [],
    multiCategoryConfirmed: true,
    items: args.items?.map((item) => ({
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
    })),
  });

  await ctx.db.patch(args.draftId, {
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName),
    paymentPurpose: trimOptional(args.paymentPurpose),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: reviewConfidence,
    updatedAt: now,
  });

  if (draft.taxSummaries && draft.taxSummaries.length > 0) {
    const { draft: updated } = await persistDraftTaxInterpretation(ctx, {
      draftId: args.draftId,
      groupId,
      preservedNonTaxReasons: nonTaxReviewReasons(classification.reviewReasons),
    });
    return updated;
  }

  await ctx.db.patch(args.draftId, {
    status: classification.status,
    reviewReasons: classification.reviewReasons,
    updatedAt: now,
  });

  const updated = await ctx.db.get(args.draftId);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated AI expense draft");
  }
  return updated;
}

import { ConvexError, v, type Infer } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  amountBasisValidator,
  classifyAiExpenseDraft,
  receiptItemTaxRatePercentValidator,
} from "./model";
import { deleteDraftAndItems } from "../../lib/convex/aiExpenseDrafts/draftRepository";
import { requireGroupMembership } from "../groups/membership";
import {
  assertActiveCategoryBelongsToGroup,
  assertPositiveCategoryTotals,
  assertReviewUpdateCanBecomeReady,
  replaceDraftItemsForReview,
  trimOptional,
  type UpdateForReviewArgs,
} from "../../lib/convex/aiExpenseDrafts/reviewValidation";
import {
  nonTaxReviewReasons,
  persistDraftTaxInterpretation,
} from "../../lib/convex/aiExpenseDrafts/persistTaxInterpretation";
import { registerReadyDraftsHandler } from "../../lib/convex/aiExpenseDrafts/registerToReceipts";
import { registerReadyDraftsAsExpenseEntriesHandler } from "../../lib/convex/aiExpenseDrafts/registerToExpenseEntries";
import { updateDraftItemTaxOverridesHandler } from "../../lib/convex/aiExpenseDrafts/updateItemTaxOverrides";
import { applyReceiptTaxSettingsHandler } from "../../lib/convex/aiExpenseDrafts/applyReceiptTaxSettings";

type DeleteDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
};

export async function deleteDraftHandler(ctx: MutationCtx, args: DeleteDraftArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    return { deleted: false };
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  if (draft.status === "registered") {
    throw new ConvexError("Registered AI expense draft cannot be deleted from the queue");
  }

  await deleteDraftAndItems(ctx, args.draftId, groupId);
  return { deleted: true };
}

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

export async function updateDraftItemTaxOverridesMutationHandler(
  ctx: MutationCtx,
  args: {
    draftId: Id<"aiExpenseDrafts">;
    itemId: Id<"aiExpenseDraftItems">;
    taxRatePercent?: Infer<typeof receiptItemTaxRatePercentValidator>;
    amountBasis?: Infer<typeof amountBasisValidator>;
  },
) {
  const { groupId } = await requireGroupMembership(ctx);
  return await updateDraftItemTaxOverridesHandler(ctx, args, groupId);
}

export { registerReadyDraftsHandler } from "../../lib/convex/aiExpenseDrafts/registerToReceipts";
export { registerReadyDraftsAsExpenseEntriesHandler } from "../../lib/convex/aiExpenseDrafts/registerToExpenseEntries";

export const deleteDraft = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: deleteDraftHandler,
});

export const updateForReview = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
    documentType: aiExpenseDraftDocumentTypeValidator,
    shopName: v.optional(v.string()),
    paymentPlace: v.optional(v.string()),
    payeeName: v.optional(v.string()),
    paymentPurpose: v.optional(v.string()),
    date: v.string(),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    items: v.optional(
      v.array(
        v.object({
          itemName: v.string(),
          amountYen: v.number(),
          categoryId: v.id("categories"),
          confidence: v.optional(aiExpenseDraftItemConfidenceValidator),
          warnings: v.optional(v.array(v.string())),
        }),
      ),
    ),
  },
  handler: updateForReviewHandler,
});

export async function applyReceiptTaxSettingsMutationHandler(
  ctx: MutationCtx,
  args: {
    draftId: Id<"aiExpenseDrafts">;
    taxRatePercent?: Infer<typeof receiptItemTaxRatePercentValidator>;
    amountBasis?: Infer<typeof amountBasisValidator>;
  },
) {
  const { groupId } = await requireGroupMembership(ctx);
  return await applyReceiptTaxSettingsHandler(ctx, args, groupId);
}

export const updateDraftItemTaxOverrides = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
    itemId: v.id("aiExpenseDraftItems"),
    taxRatePercent: v.optional(receiptItemTaxRatePercentValidator),
    amountBasis: v.optional(amountBasisValidator),
  },
  handler: updateDraftItemTaxOverridesMutationHandler,
});

export const applyReceiptTaxSettings = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
    taxRatePercent: v.optional(receiptItemTaxRatePercentValidator),
    amountBasis: v.optional(amountBasisValidator),
  },
  handler: applyReceiptTaxSettingsMutationHandler,
});

export const registerReadyDrafts = mutation({
  args: {
    draftIds: v.array(v.id("aiExpenseDrafts")),
  },
  handler: registerReadyDraftsHandler,
});

export const registerReadyDraftsAsExpenseEntries = mutation({
  args: {
    draftIds: v.array(v.id("aiExpenseDrafts")),
  },
  handler: registerReadyDraftsAsExpenseEntriesHandler,
});

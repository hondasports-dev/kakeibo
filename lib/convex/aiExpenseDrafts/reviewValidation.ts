import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { isValidSignedLineItemAmount } from "../../../lib/domain/receipt/discountItems";
import { trimOptional } from "../../../lib/domain/common/string";
import {
  type ReviewUpdateReadyError,
  validateReviewUpdateCanBecomeReady,
} from "../../../lib/domain/aiExpenseDrafts/review";
import { type AiExpenseDraftDocumentType } from "./validators";
import { resolveReviewItemAmountsForReplace } from "../../../lib/domain/aiExpenseDrafts/reviewItemAmounts";
import {
  aggregateDraftItemsByCategory as aggregateDraftItemsByCategoryDomain,
  validatePositiveCategoryTotals,
} from "../../../lib/domain/aiExpenseDrafts/reviewItems";

export { resolveReviewItemAmountsForReplace } from "../../../lib/domain/aiExpenseDrafts/reviewItemAmounts";
export {
  hasLowConfidenceItem,
  summarizeItems,
} from "../../../lib/domain/aiExpenseDrafts/reviewItems";

export type UpdateForReviewItem = {
  itemId?: Id<"aiExpenseDraftItems">;
  itemName: string;
  amountYen: number;
  categoryId: Id<"categories">;
  confidence?: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
  warnings?: string[];
};

export type UpdateForReviewArgs = {
  draftId: Id<"aiExpenseDrafts">;
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date: string;
  amountYen: number;
  categoryId: Id<"categories">;
  items?: UpdateForReviewItem[];
};

const reviewUpdateReadyErrorMessages: Record<ReviewUpdateReadyError, string> = {
  unknown_document_type: "Draft document type must be selected to mark ready",
  missing_date: "Draft date is required to mark ready",
  invalid_date: "Draft date must be a valid YYYY-MM-DD date",
  invalid_amount: "Draft amount is required to mark ready",
  missing_counterparty: "Draft shop, payment place, or payee is required to mark ready",
};

export function assertReviewUpdateCanBecomeReady(args: UpdateForReviewArgs) {
  const result = validateReviewUpdateCanBecomeReady(args);
  if (result.success) return;

  if (result.error === "missing_counterparty" && args.documentType === "convenience_payment") {
    throw new ConvexError("Draft shop name or payment details are required to mark ready");
  }
  throw new ConvexError(reviewUpdateReadyErrorMessages[result.error]);
}

export async function assertActiveCategoryBelongsToGroup(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories">,
  groupId: Id<"groups">,
) {
  const category = await ctx.db.get(categoryId);
  if (category === null || category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
  if (!category.isActive) {
    throw new ConvexError("Inactive category cannot be used for reviewed drafts");
  }
}

export function assertPositiveCategoryTotals(items: NonNullable<UpdateForReviewArgs["items"]>) {
  if (!validatePositiveCategoryTotals(items)) {
    throw new ConvexError("Draft category total must be greater than zero");
  }
}

type AggregationError =
  | "invalid_item_amount"
  | "missing_category"
  | "low_confidence"
  | "amount_mismatch"
  | "non_positive_category_total";

const errorMessageByAggregationError: Record<AggregationError, string> = {
  invalid_item_amount: "Draft item amount is required to register",
  missing_category: "Draft item category is required to register",
  low_confidence: "Low confidence draft items must be reviewed before register",
  amount_mismatch: "Draft item total must match draft amount",
  non_positive_category_total: "Draft category total must be greater than zero",
};

export function aggregateDraftItemsByCategory(
  draft: Doc<"aiExpenseDrafts">,
  items: Doc<"aiExpenseDraftItems">[],
): Array<{ itemName: string; amountYen: number; categoryId: Id<"categories"> }> {
  const result = aggregateDraftItemsByCategoryDomain(
    {
      amountYen: draft.amountYen!,
      categoryId: draft.categoryId!,
      documentType: draft.documentType,
      shopName: draft.shopName,
      paymentPlace: draft.paymentPlace,
      payeeName: draft.payeeName,
      paymentPurpose: draft.paymentPurpose,
    },
    items,
  );
  if (!result.success) {
    throw new ConvexError(errorMessageByAggregationError[result.error]);
  }
  return result.items as Array<{
    itemName: string;
    amountYen: number;
    categoryId: Id<"categories">;
  }>;
}

export async function replaceDraftItemsForReview(
  ctx: Pick<MutationCtx, "db">,
  draftId: Id<"aiExpenseDrafts">,
  groupId: Id<"groups">,
  items: NonNullable<UpdateForReviewArgs["items"]>,
  now: number,
) {
  if (items.length > 100) {
    throw new ConvexError("Draft items must be 100 or fewer");
  }
  const existingItems = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId).eq("draftId", draftId))
    .order("asc")
    .take(100);
  const existingItemsById = new Map(existingItems.map((item) => [item._id, item]));
  const submittedItemIds = new Set<Id<"aiExpenseDraftItems">>();
  for (const item of items) {
    if (item.itemId === undefined) {
      continue;
    }
    if (submittedItemIds.has(item.itemId)) {
      throw new ConvexError("Draft item ID must not be duplicated");
    }
    if (!existingItemsById.has(item.itemId)) {
      throw new ConvexError("Draft item does not belong to the current draft");
    }
    submittedItemIds.add(item.itemId);
  }
  for (const item of existingItems) {
    await ctx.db.delete(item._id);
  }
  for (const item of items) {
    const itemName = trimOptional(item.itemName);
    if (!itemName || !isValidSignedLineItemAmount(itemName, item.amountYen)) {
      throw new ConvexError("Draft item name and amount are required");
    }
    await assertActiveCategoryBelongsToGroup(ctx, item.categoryId, groupId);
    const previous = item.itemId === undefined ? undefined : existingItemsById.get(item.itemId);
    const amounts = resolveReviewItemAmountsForReplace(item.amountYen, previous);
    await ctx.db.insert("aiExpenseDraftItems", {
      groupId,
      draftId,
      itemName,
      amountYen: amounts.amountYen,
      printedAmountYen: amounts.printedAmountYen,
      categoryId: item.categoryId,
      amountBasis: previous?.amountBasis,
      taxRatePercent: previous?.taxRatePercent,
      markers: previous?.markers,
      taxMarker: previous?.taxMarker,
      allocatedTaxYen: previous?.allocatedTaxYen,
      normalizedAmountYen:
        "normalizedAmountYen" in amounts
          ? amounts.normalizedAmountYen
          : previous?.normalizedAmountYen,
      taxResolutionStatus: previous?.taxResolutionStatus,
      taxResolutionSource: previous?.taxResolutionSource,
      taxReviewReasons: previous?.taxReviewReasons,
      quantity: previous?.quantity,
      unitPriceYen: previous?.unitPriceYen,
      categoryName: previous?.categoryName,
      confidence: item.confidence ?? {
        itemName: 1,
        amountYen: 1,
        categoryId: 1,
      },
      warnings: item.warnings ?? previous?.warnings,
      createdAt: now,
      updatedAt: now,
    });
  }
}

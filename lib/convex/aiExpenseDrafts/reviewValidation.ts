import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { isValidSignedLineItemAmount } from "../../../convex/lib/discountItems";
import {
  AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD,
  type AiExpenseDraftDocumentType,
} from "./validators";
import { resolveReceiptShopNameFromDraft } from "./display";

export type UpdateForReviewItem = {
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

export function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function hasCounterparty(args: UpdateForReviewArgs) {
  if (args.documentType === "convenience_payment") {
    return (
      !!trimOptional(args.shopName) ||
      (!!trimOptional(args.payeeName) && !!trimOptional(args.paymentPurpose))
    );
  }
  return (
    !!trimOptional(args.shopName) ||
    !!trimOptional(args.payeeName) ||
    !!trimOptional(args.paymentPlace)
  );
}

export function assertReviewUpdateCanBecomeReady(args: UpdateForReviewArgs) {
  if (args.documentType === "unknown") {
    throw new ConvexError("Draft document type must be selected to mark ready");
  }
  const date = trimOptional(args.date);
  if (!date) {
    throw new ConvexError("Draft date is required to mark ready");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsedDate = match ? new Date(`${date}T00:00:00Z`) : null;
  if (
    !match ||
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new ConvexError("Draft date must be a valid YYYY-MM-DD date");
  }
  if (!Number.isInteger(args.amountYen) || args.amountYen <= 0) {
    throw new ConvexError("Draft amount is required to mark ready");
  }
  if (!hasCounterparty(args)) {
    if (args.documentType === "convenience_payment") {
      throw new ConvexError("Draft shop name or payment details are required to mark ready");
    }
    throw new ConvexError("Draft shop, payment place, or payee is required to mark ready");
  }
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
  const totals = new Map<Id<"categories">, number>();
  for (const item of items) {
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountYen);
  }
  if ([...totals.values()].some((amountYen) => amountYen <= 0)) {
    throw new ConvexError("Draft category total must be greater than zero");
  }
}

export function hasLowConfidenceDraftItem(item: Doc<"aiExpenseDraftItems">) {
  return (
    (item.confidence.itemName ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.amountYen ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.categoryId ?? item.confidence.categoryName ?? 1) <
      AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD
  );
}

export function hasLowConfidenceItem(item: {
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
}) {
  return (
    (item.confidence.itemName ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.amountYen ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.categoryId ?? item.confidence.categoryName ?? 1) <
      AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD
  );
}

export function summarizeItems(
  draft: { amountYen?: number },
  items: Array<{
    amountYen: number;
    categoryId?: Id<"categories">;
    confidence: {
      itemName?: number;
      amountYen?: number;
      categoryName?: number;
      categoryId?: number;
    };
  }>,
) {
  if (items.length === 0) {
    return undefined;
  }

  const categoryAmounts = new Map<Id<"categories">, number>();
  let itemTotalYen = 0;
  let hasUncategorizedItems = false;
  let hasLowConfidenceItems = false;

  for (const item of items) {
    itemTotalYen += item.amountYen;
    if (item.categoryId === undefined) {
      hasUncategorizedItems = true;
    } else {
      categoryAmounts.set(
        item.categoryId,
        (categoryAmounts.get(item.categoryId) ?? 0) + item.amountYen,
      );
    }
    if (hasLowConfidenceItem(item)) {
      hasLowConfidenceItems = true;
    }
  }

  return {
    itemTotalYen,
    itemDifferenceYen: draft.amountYen === undefined ? undefined : draft.amountYen - itemTotalYen,
    hasUncategorizedItems,
    hasLowConfidenceItems,
    categoryAggregates: Array.from(categoryAmounts.entries()).map(([categoryId, amountYen]) => ({
      categoryId,
      amountYen,
    })),
  };
}

export function aggregateDraftItemsByCategory(
  draft: Doc<"aiExpenseDrafts">,
  items: Doc<"aiExpenseDraftItems">[],
) {
  if (items.length === 0) {
    return [
      {
        itemName: resolveReceiptShopNameFromDraft(draft),
        amountYen: draft.amountYen!,
        categoryId: draft.categoryId!,
      },
    ];
  }

  let itemTotal = 0;
  const categoryAmounts = new Map<Id<"categories">, number>();
  for (const item of items) {
    if (!isValidSignedLineItemAmount(item.itemName, item.amountYen)) {
      throw new ConvexError("Draft item amount is required to register");
    }
    if (item.categoryId === undefined) {
      throw new ConvexError("Draft item category is required to register");
    }
    if (hasLowConfidenceDraftItem(item)) {
      throw new ConvexError("Low confidence draft items must be reviewed before register");
    }

    itemTotal += item.amountYen;
    categoryAmounts.set(
      item.categoryId,
      (categoryAmounts.get(item.categoryId) ?? 0) + item.amountYen,
    );
  }

  if (itemTotal !== draft.amountYen) {
    throw new ConvexError("Draft item total must match draft amount");
  }
  if ([...categoryAmounts.values()].some((amountYen) => amountYen <= 0)) {
    throw new ConvexError("Draft category total must be greater than zero");
  }

  const title = resolveReceiptShopNameFromDraft(draft);
  return Array.from(categoryAmounts.entries()).map(([categoryId, amountYen]) => ({
    itemName: title,
    amountYen,
    categoryId,
  }));
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
  for (const item of existingItems) {
    await ctx.db.delete(item._id);
  }
  for (const item of items) {
    const itemName = trimOptional(item.itemName);
    if (!itemName || !isValidSignedLineItemAmount(itemName, item.amountYen)) {
      throw new ConvexError("Draft item name and amount are required");
    }
    await assertActiveCategoryBelongsToGroup(ctx, item.categoryId, groupId);
    await ctx.db.insert("aiExpenseDraftItems", {
      groupId,
      draftId,
      itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
      confidence: item.confidence ?? {
        itemName: 1,
        amountYen: 1,
        categoryId: 1,
      },
      warnings: item.warnings,
      createdAt: now,
      updatedAt: now,
    });
  }
}

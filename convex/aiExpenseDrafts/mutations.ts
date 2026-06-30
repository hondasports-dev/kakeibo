import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  classifyAiExpenseDraft,
  resolveReceiptShopNameFromDraft,
  type AiExpenseDraftDocumentType,
} from "./model";
import { createExpenseEntriesFromDraftHandler } from "../expenseEntries/mutations";
import { insertReceiptForGroup } from "../receipts/crud";
import { requireGroupMembership } from "../groups/membership";
import { deleteDraftAndItems } from "./internal";
import { isValidSignedLineItemAmount } from "../lib/discountItems";

type RegisterReadyDraftsArgs = {
  draftIds: Id<"aiExpenseDrafts">[];
};

type UpdateForReviewArgs = {
  draftId: Id<"aiExpenseDrafts">;
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date: string;
  amountYen: number;
  categoryId: Id<"categories">;
  items?: Array<{
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
  }>;
};

type DeleteDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
};

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasCounterparty(args: UpdateForReviewArgs) {
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

function assertReviewUpdateCanBecomeReady(args: UpdateForReviewArgs) {
  if (args.documentType === "unknown") {
    throw new ConvexError("Draft document type must be selected to mark ready");
  }
  if (!trimOptional(args.date)) {
    throw new ConvexError("Draft date is required to mark ready");
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

async function assertActiveCategoryBelongsToGroup(
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

function dedupeDraftIds(draftIds: Id<"aiExpenseDrafts">[]) {
  return [...new Set(draftIds)];
}

function assertReadyDraftCanBeRegistered(draft: Doc<"aiExpenseDrafts">) {
  if (draft.status !== "ready") {
    throw new ConvexError("Only ready drafts can be registered");
  }
  if (!draft.date) {
    throw new ConvexError("Draft date is required to register");
  }
  if (draft.amountYen === undefined || draft.amountYen <= 0) {
    throw new ConvexError("Draft amount is required to register");
  }
  if (!draft.categoryId) {
    throw new ConvexError("Draft category is required to register");
  }
}

function assertPositiveCategoryTotals(items: NonNullable<UpdateForReviewArgs["items"]>) {
  const totals = new Map<Id<"categories">, number>();
  for (const item of items) {
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountYen);
  }
  if ([...totals.values()].some((amountYen) => amountYen <= 0)) {
    throw new ConvexError("Draft category total must be greater than zero");
  }
}

function hasLowConfidenceDraftItem(item: Doc<"aiExpenseDraftItems">) {
  return (
    (item.confidence.itemName ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.amountYen ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.categoryId ?? item.confidence.categoryName ?? 1) <
      AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD
  );
}

function aggregateDraftItemsByCategory(
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

async function replaceDraftItemsForReview(
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
  if (draft.status !== "needs_review") {
    throw new ConvexError("Only needs_review AI expense drafts can be edited");
  }

  await assertActiveCategoryBelongsToGroup(ctx, args.categoryId, groupId);
  assertReviewUpdateCanBecomeReady(args);

  const now = Date.now();
  if (args.items !== undefined) {
    assertPositiveCategoryTotals(args.items);
    await replaceDraftItemsForReview(ctx, args.draftId, groupId, args.items, now);
  }
  const classification = classifyAiExpenseDraft({
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName) ?? trimOptional(args.shopName),
    paymentPurpose: trimOptional(args.paymentPurpose) ?? trimOptional(args.shopName),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: {
      ...draft.confidence,
      documentType: 1,
      shopName: trimOptional(args.shopName) ? 1 : draft.confidence.shopName,
      paymentPlace: trimOptional(args.paymentPlace) ? 1 : draft.confidence.paymentPlace,
      payeeName:
        trimOptional(args.payeeName) || trimOptional(args.shopName)
          ? 1
          : draft.confidence.payeeName,
      paymentPurpose:
        trimOptional(args.paymentPurpose) || trimOptional(args.shopName)
          ? 1
          : draft.confidence.paymentPurpose,
      date: 1,
      amountYen: 1,
      categoryId: 1,
    },
    warnings: [],
    items: args.items?.map((item) => ({
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
    })),
  });
  await ctx.db.patch(args.draftId, {
    status: classification.status,
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName),
    paymentPurpose: trimOptional(args.paymentPurpose),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: {
      ...draft.confidence,
      documentType: 1,
      shopName: trimOptional(args.shopName) ? 1 : draft.confidence.shopName,
      paymentPlace: trimOptional(args.paymentPlace) ? 1 : draft.confidence.paymentPlace,
      payeeName: trimOptional(args.payeeName) ? 1 : draft.confidence.payeeName,
      paymentPurpose: trimOptional(args.paymentPurpose) ? 1 : draft.confidence.paymentPurpose,
      date: 1,
      amountYen: 1,
      categoryId: 1,
    },
    reviewReasons: classification.reviewReasons,
    updatedAt: now,
  });

  const updated = await ctx.db.get(args.draftId);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated AI expense draft");
  }
  return updated;
}

export async function registerReadyDraftsHandler(ctx: MutationCtx, args: RegisterReadyDraftsArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const uniqueDraftIds = dedupeDraftIds(args.draftIds);
  if (uniqueDraftIds.length === 0) {
    return {
      registeredDraftIds: [] as Id<"aiExpenseDrafts">[],
      registeredReceiptIds: [] as Id<"receipts">[],
      alreadyRegisteredDraftIds: [] as Id<"aiExpenseDrafts">[],
    };
  }

  const drafts = await Promise.all(
    uniqueDraftIds.map(async (draftId) => {
      const draft = await ctx.db.get(draftId);
      if (draft === null) {
        throw new ConvexError("AI expense draft not found");
      }
      if (draft.groupId !== groupId) {
        throw new ConvexError("AI expense draft does not belong to the current group");
      }
      return draft;
    }),
  );

  const draftsToRegister: Doc<"aiExpenseDrafts">[] = [];
  const alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[] = [];

  for (const draft of drafts) {
    if (draft.status === "registered" && draft.registeredReceiptId) {
      alreadyRegisteredDraftIds.push(draft._id);
      continue;
    }
    assertReadyDraftCanBeRegistered(draft);
    draftsToRegister.push(draft);
  }

  const registeredReceiptIds: Id<"receipts">[] = [];

  for (const draft of draftsToRegister) {
    const receiptId = await insertReceiptForGroup(ctx, groupId, {
      type: "expense",
      date: draft.date!,
      shopName: resolveReceiptShopNameFromDraft(draft),
      amountYen: draft.amountYen!,
      categoryId: draft.categoryId!,
    });
    registeredReceiptIds.push(receiptId);
  }

  const now = Date.now();
  await Promise.all(
    draftsToRegister.map((draft, index) =>
      ctx.db.patch(draft._id, {
        status: "registered",
        registeredReceiptId: registeredReceiptIds[index],
        updatedAt: now,
      }),
    ),
  );

  return {
    registeredDraftIds: draftsToRegister.map((draft) => draft._id),
    registeredReceiptIds,
    alreadyRegisteredDraftIds,
  };
}

export async function registerReadyDraftsAsExpenseEntriesHandler(
  ctx: MutationCtx,
  args: RegisterReadyDraftsArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  const uniqueDraftIds = dedupeDraftIds(args.draftIds);
  if (uniqueDraftIds.length === 0) {
    return {
      registeredDraftIds: [] as Id<"aiExpenseDrafts">[],
      createdExpenseEntryIds: [] as Id<"expenseEntries">[],
      alreadyRegisteredDraftIds: [] as Id<"aiExpenseDrafts">[],
    };
  }

  const drafts = await Promise.all(
    uniqueDraftIds.map(async (draftId) => {
      const draft = await ctx.db.get(draftId);
      if (draft === null) {
        throw new ConvexError("AI expense draft not found");
      }
      if (draft.groupId !== groupId) {
        throw new ConvexError("AI expense draft does not belong to the current group");
      }
      return draft;
    }),
  );

  const draftsToRegister: Doc<"aiExpenseDrafts">[] = [];
  const alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[] = [];

  for (const draft of drafts) {
    if (draft.status === "registered") {
      alreadyRegisteredDraftIds.push(draft._id);
      continue;
    }
    assertReadyDraftCanBeRegistered(draft);
    draftsToRegister.push(draft);
  }

  const createdExpenseEntryIds: Id<"expenseEntries">[] = [];

  for (const draft of draftsToRegister) {
    // aiExpenseDraftItemsを現在のグループ境界内で取得する。
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", groupId).eq("draftId", draft._id),
      )
      .order("asc")
      .take(100);

    const itemsToRegister = aggregateDraftItemsByCategory(draft, items);

    const entryIds = await createExpenseEntriesFromDraftHandler(ctx, {
      draftId: draft._id,
      items: itemsToRegister,
    });
    createdExpenseEntryIds.push(...entryIds);
  }

  const now = Date.now();
  await Promise.all(
    draftsToRegister.map((draft) =>
      ctx.db.patch(draft._id, {
        status: "registered",
        updatedAt: now,
      }),
    ),
  );

  return {
    registeredDraftIds: draftsToRegister.map((draft) => draft._id),
    createdExpenseEntryIds,
    alreadyRegisteredDraftIds,
  };
}

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

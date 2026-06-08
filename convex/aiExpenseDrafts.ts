import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AI_EXPENSE_DRAFT_REVIEW_REASONS,
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
  aiExpenseDraftStatusValidator,
  classifyAiExpenseDraft,
  resolveReceiptShopNameFromDraft,
  type AiExpenseDraftConfidence,
  type AiExpenseDraftDocumentType,
  type AiExpenseDraftReviewReason,
} from "./aiExpenseDraftsModel";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "./categoryCandidate";
import { extractReceiptFieldsHandler } from "./receiptImageExtraction";
import { insertReceiptForUser } from "./receipts";
import { requireAuthenticatedUserId } from "./users";

const LIST_LIMIT = 100;

type AiExpenseDraftStatus =
  | "queued"
  | "analyzing"
  | "ready"
  | "needs_review"
  | "failed"
  | "registered";

type AiExpenseDraftItemInput = {
  itemName: string;
  amountYen: number;
  categoryId?: Id<"categories">;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryId?: number;
  };
};

type CreateFromExtractionArgs = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: Id<"categories">;
  imageFileName?: string;
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  reviewReasons?: AiExpenseDraftReviewReason[];
  items?: AiExpenseDraftItemInput[];
};

type CreateFailedDraftFromImageAnalysisArgs = {
  warning: string;
  imageFileName?: string;
};

type ListByStatusArgs = {
  status: AiExpenseDraftStatus;
};

type GetWithItemsArgs = {
  draftId: Id<"aiExpenseDrafts">;
};

type AnalyzeReceiptImageToDraftArgs = {
  imageDataUrl: string;
};

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
};

type DeleteDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
};

type DeleteDraftsByUserBatchArgs = {
  userId: string;
  limit?: number;
};

function mergeReviewReasons(
  computedReasons: AiExpenseDraftReviewReason[],
  explicitReasons: AiExpenseDraftReviewReason[] | undefined,
) {
  const reasons = new Set<AiExpenseDraftReviewReason>(computedReasons);
  for (const reason of explicitReasons ?? []) {
    reasons.add(reason);
  }
  return AI_EXPENSE_DRAFT_REVIEW_REASONS.filter((reason) => reasons.has(reason));
}

function resolveDraftClassification(args: CreateFromExtractionArgs): {
  status: "ready" | "needs_review";
  reviewReasons: AiExpenseDraftReviewReason[];
} {
  const computed = classifyAiExpenseDraft(args);
  const reviewReasons = mergeReviewReasons(computed.reviewReasons, args.reviewReasons);
  return {
    status: reviewReasons.length === 0 ? "ready" : "needs_review",
    reviewReasons,
  };
}

async function assertCategoryBelongsToUser(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories"> | undefined,
  userId: string,
) {
  if (categoryId === undefined) {
    return;
  }
  const category = await ctx.db.get(categoryId);
  if (category === null || category.userId !== userId) {
    throw new ConvexError("Category does not belong to the current user");
  }
}

async function assertActiveCategoryBelongsToUser(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories">,
  userId: string,
) {
  const category = await ctx.db.get(categoryId);
  if (category === null || category.userId !== userId) {
    throw new ConvexError("Category does not belong to the current user");
  }
  if (!category.isActive) {
    throw new ConvexError("Inactive category cannot be used for reviewed drafts");
  }
}

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasCounterparty(args: UpdateForReviewArgs) {
  if (args.documentType === "convenience_payment") {
    return !!trimOptional(args.payeeName) && !!trimOptional(args.paymentPurpose);
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
      throw new ConvexError("Draft payee and payment purpose are required to mark ready");
    }
    throw new ConvexError("Draft shop, payment place, or payee is required to mark ready");
  }
}

async function insertDraftItems(
  ctx: Pick<MutationCtx, "db">,
  userId: string,
  draftId: Id<"aiExpenseDrafts">,
  items: AiExpenseDraftItemInput[],
  now: number,
) {
  for (const item of items) {
    await assertCategoryBelongsToUser(ctx, item.categoryId, userId);
    await ctx.db.insert("aiExpenseDraftItems", {
      userId,
      draftId,
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
      confidence: item.confidence,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function deleteDraftAndItems(
  ctx: Pick<MutationCtx, "db">,
  draftId: Id<"aiExpenseDrafts">,
  userId: string,
) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.userId !== userId || draft.status === "registered") {
    return;
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_user_id_and_draft_id", (q) => q.eq("userId", userId).eq("draftId", draftId))
    .collect();
  await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  await ctx.db.delete(draftId);
}

export async function createFromExtractionHandler(
  ctx: MutationCtx,
  args: CreateFromExtractionArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);
  await assertCategoryBelongsToUser(ctx, args.categoryId, userId);

  const now = Date.now();
  const classification = resolveDraftClassification(args);
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    userId,
    sourceType: "image_upload",
    status: classification.status,
    documentType: args.documentType,
    imageFileName: args.imageFileName,
    shopName: args.shopName,
    paymentPlace: args.paymentPlace,
    payeeName: args.payeeName,
    paymentPurpose: args.paymentPurpose,
    date: args.date,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: args.confidence,
    warnings: args.warnings,
    reviewReasons: classification.reviewReasons,
    createdAt: now,
    updatedAt: now,
  });

  await insertDraftItems(ctx, userId, draftId, args.items ?? [], now);

  const draft = await ctx.db.get(draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft was not found after creation");
  }
  return draft;
}

export const createFromExtraction = internalMutation({
  args: {
    documentType: aiExpenseDraftDocumentTypeValidator,
    shopName: v.optional(v.string()),
    paymentPlace: v.optional(v.string()),
    payeeName: v.optional(v.string()),
    paymentPurpose: v.optional(v.string()),
    date: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    imageFileName: v.optional(v.string()),
    confidence: aiExpenseDraftConfidenceValidator,
    warnings: v.array(v.string()),
    reviewReasons: v.optional(v.array(aiExpenseDraftReviewReasonValidator)),
    items: v.optional(
      v.array(
        v.object({
          itemName: v.string(),
          amountYen: v.number(),
          categoryId: v.optional(v.id("categories")),
          confidence: aiExpenseDraftItemConfidenceValidator,
        }),
      ),
    ),
  },
  handler: createFromExtractionHandler,
});

export async function createFailedDraftFromImageAnalysisHandler(
  ctx: MutationCtx,
  args: CreateFailedDraftFromImageAnalysisArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);
  const now = Date.now();
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    userId,
    sourceType: "image_upload",
    status: "failed",
    documentType: "unknown",
    imageFileName: args.imageFileName,
    confidence: {},
    warnings: [args.warning],
    reviewReasons: ["parse_failed"],
    createdAt: now,
    updatedAt: now,
  });

  const draft = await ctx.db.get(draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft was not found after creation");
  }
  return draft;
}

export const createFailedDraftFromImageAnalysis = internalMutation({
  args: {
    warning: v.string(),
    imageFileName: v.optional(v.string()),
  },
  handler: createFailedDraftFromImageAnalysisHandler,
});

export async function deleteOrphanedDraftHandler(
  ctx: MutationCtx,
  args: { draftId: Id<"aiExpenseDrafts"> },
) {
  const userId = await requireAuthenticatedUserId(ctx);
  await deleteDraftAndItems(ctx, args.draftId, userId);
}

export const deleteOrphanedDraft = internalMutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: deleteOrphanedDraftHandler,
});

export async function deleteDraftHandler(ctx: MutationCtx, args: DeleteDraftArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    return { deleted: false };
  }
  if (draft.userId !== userId) {
    throw new ConvexError("AI expense draft does not belong to the current user");
  }
  if (draft.status === "registered") {
    throw new ConvexError("Registered AI expense draft cannot be deleted from the queue");
  }

  await deleteDraftAndItems(ctx, args.draftId, userId);
  return { deleted: true };
}

export const deleteDraft = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: deleteDraftHandler,
});

export async function deleteDraftsByUserBatchHandler(
  ctx: MutationCtx,
  args: DeleteDraftsByUserBatchArgs,
) {
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 100);
  const drafts = await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_user_id_and_created_at", (q) => q.eq("userId", args.userId))
    .order("asc")
    .take(limit);

  let deletedDraftCount = 0;
  let deletedItemCount = 0;

  for (const draft of drafts) {
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_user_id_and_draft_id", (q) =>
        q.eq("userId", args.userId).eq("draftId", draft._id),
      )
      .take(100);
    for (const item of items) {
      await ctx.db.delete(item._id);
      deletedItemCount += 1;
    }
    await ctx.db.delete(draft._id);
    deletedDraftCount += 1;
  }

  return {
    deletedDraftCount,
    deletedItemCount,
    hasMore: drafts.length === limit,
  };
}

export const deleteDraftsByUserBatch = internalMutation({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: deleteDraftsByUserBatchHandler,
});

export async function listByStatusHandler(ctx: QueryCtx, args: ListByStatusArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
  return await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_user_id_and_status_and_created_at", (q) =>
      q.eq("userId", userId).eq("status", args.status),
    )
    .order("desc")
    .take(LIST_LIMIT);
}

export const listByStatus = query({
  args: {
    status: aiExpenseDraftStatusValidator,
  },
  handler: listByStatusHandler,
});

export async function getWithItemsHandler(ctx: QueryCtx, args: GetWithItemsArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    return null;
  }
  if (draft.userId !== userId) {
    throw new ConvexError("AI expense draft does not belong to the current user");
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_user_id_and_draft_id", (q) => q.eq("userId", userId).eq("draftId", args.draftId))
    .order("asc")
    .take(LIST_LIMIT);

  return { draft, items };
}

export const getWithItems = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getWithItemsHandler,
});

export async function updateForReviewHandler(ctx: MutationCtx, args: UpdateForReviewArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft not found");
  }
  if (draft.userId !== userId) {
    throw new ConvexError("AI expense draft does not belong to the current user");
  }
  if (draft.status === "registered") {
    throw new ConvexError("Registered AI expense draft cannot be edited");
  }
  if (draft.status !== "needs_review") {
    throw new ConvexError("Only needs_review AI expense drafts can be edited");
  }

  await assertActiveCategoryBelongsToUser(ctx, args.categoryId, userId);
  assertReviewUpdateCanBecomeReady(args);

  const now = Date.now();
  await ctx.db.patch(args.draftId, {
    status: "ready",
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
    reviewReasons: [],
    updatedAt: now,
  });

  const updated = await ctx.db.get(args.draftId);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated AI expense draft");
  }
  return updated;
}

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
  },
  handler: updateForReviewHandler,
});

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

export async function registerReadyDraftsHandler(ctx: MutationCtx, args: RegisterReadyDraftsArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
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
      if (draft.userId !== userId) {
        throw new ConvexError("AI expense draft does not belong to the current user");
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
    const receiptId = await insertReceiptForUser(ctx, userId, {
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

export const registerReadyDrafts = mutation({
  args: {
    draftIds: v.array(v.id("aiExpenseDrafts")),
  },
  handler: registerReadyDraftsHandler,
});

function getSafeFailureWarning(err: unknown) {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "画像解析に失敗しました";
}

export async function analyzeReceiptImageToDraftHandler(
  ctx: ActionCtx,
  args: AnalyzeReceiptImageToDraftArgs,
): Promise<Doc<"aiExpenseDrafts">> {
  const consent: { hasAcceptedExternalApiConsent: boolean } = await ctx.runQuery(
    api.users.getReceiptImageConsent,
    {},
  );
  if (!consent.hasAcceptedExternalApiConsent) {
    throw new ConvexError("Receipt image external API consent is required");
  }

  let extracted;
  try {
    extracted = await extractReceiptFieldsHandler(ctx, args);
  } catch (err) {
    const draft: Doc<"aiExpenseDrafts"> = await ctx.runMutation(
      internal.aiExpenseDrafts.createFailedDraftFromImageAnalysis,
      {
        warning: getSafeFailureWarning(err),
      },
    );
    return draft;
  }

  // カテゴリ候補を生成し、AI が推定したカテゴリ名を候補の中で解決する。
  // - コンビニ払込票では paymentPlace を主根拠にせず paymentPurpose / payeeName を優先する。
  // - 候補にないカテゴリ名は採用しない（存在しないカテゴリIDを保存しない）。
  const categories = await ctx.runQuery(api.categories.listActive, {});
  const candidates = buildCategoryCandidates({
    documentType: extracted.documentType,
    categoryName: extracted.categoryName,
    shopName: extracted.shopName || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    categories,
  });
  const categoryId = resolveCategoryIdFromCandidates(extracted.categoryName, candidates);

  const draft: Doc<"aiExpenseDrafts"> = await ctx.runMutation(
    internal.aiExpenseDrafts.createFromExtraction,
    {
      documentType: extracted.documentType,
      shopName: extracted.shopName || undefined,
      paymentPlace: extracted.paymentPlace || undefined,
      payeeName: extracted.payeeName || undefined,
      paymentPurpose: extracted.paymentPurpose || undefined,
      date: extracted.date || undefined,
      amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
      categoryId,
      confidence: {
        documentType: extracted.confidence.documentType,
        shopName: extracted.confidence.shopName,
        paymentPlace: extracted.confidence.paymentPlace,
        payeeName: extracted.confidence.payeeName,
        paymentPurpose: extracted.confidence.paymentPurpose,
        date: extracted.confidence.date,
        amountYen: extracted.confidence.amountYen,
        categoryId: extracted.confidence.categoryName,
      },
      warnings: extracted.warnings,
    },
  );
  return draft;
}

export const analyzeReceiptImageToDraft = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: analyzeReceiptImageToDraftHandler,
});

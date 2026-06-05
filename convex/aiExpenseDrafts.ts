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
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  reviewReasons?: AiExpenseDraftReviewReason[];
  items?: AiExpenseDraftItemInput[];
};

type CreateFailedDraftFromImageAnalysisArgs = {
  warning: string;
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
  },
  handler: createFailedDraftFromImageAnalysisHandler,
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

  const draft: Doc<"aiExpenseDrafts"> = await ctx.runMutation(
    internal.aiExpenseDrafts.createFromExtraction,
    {
      documentType: "receipt",
      shopName: extracted.shopName || undefined,
      date: extracted.date || undefined,
      amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
      confidence: {
        shopName: extracted.confidence.shopName,
        date: extracted.confidence.date,
        amountYen: extracted.confidence.amountYen,
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

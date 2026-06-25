import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  AI_EXPENSE_DRAFT_REVIEW_REASONS,
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
  classifyAiExpenseDraft,
  type AiExpenseDraftConfidence,
  type AiExpenseDraftDocumentType,
  type AiExpenseDraftReviewReason,
} from "./model";
import { requireGroupMembership } from "../groups/membership";

type AiExpenseDraftItemInput = {
  itemName: string;
  amountYen: number;
  categoryName?: string;
  categoryId?: Id<"categories">;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
  warnings?: string[];
};

export type CreateFromExtractionArgs = {
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

export type CreateFailedDraftFromImageAnalysisArgs = {
  warning: string;
  imageFileName?: string;
};

export type DeleteDraftsByUserBatchArgs = {
  groupId: Id<"groups">;
  limit?: number;
};

export type CreateE2eReadyDraftForUserArgs = {
  groupId: Id<"groups">;
  categoryId: Id<"categories">;
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

async function assertCategoryBelongsToGroup(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories"> | undefined,
  groupId: Id<"groups">,
) {
  if (categoryId === undefined) {
    return;
  }
  const category = await ctx.db.get(categoryId);
  if (category === null || category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
}

async function insertDraftItems(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  draftId: Id<"aiExpenseDrafts">,
  items: AiExpenseDraftItemInput[],
  now: number,
) {
  for (const item of items) {
    await assertCategoryBelongsToGroup(ctx, item.categoryId, groupId);
    await ctx.db.insert("aiExpenseDraftItems", {
      groupId,
      draftId,
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryName: item.categoryName,
      categoryId: item.categoryId,
      confidence: item.confidence,
      warnings: item.warnings,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deleteDraftAndItems(
  ctx: Pick<MutationCtx, "db">,
  draftId: Id<"aiExpenseDrafts">,
  groupId: Id<"groups">,
) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.groupId !== groupId || draft.status === "registered") {
    return;
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId).eq("draftId", draftId))
    .collect();
  await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  await ctx.db.delete(draftId);
}

export async function createFromExtractionHandler(
  ctx: MutationCtx,
  args: CreateFromExtractionArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  await assertCategoryBelongsToGroup(ctx, args.categoryId, groupId);

  const now = Date.now();
  const classification = resolveDraftClassification(args);
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId,
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

  await insertDraftItems(ctx, groupId, draftId, args.items ?? [], now);

  const draft = await ctx.db.get(draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft was not found after creation");
  }
  return draft;
}

export async function createFailedDraftFromImageAnalysisHandler(
  ctx: MutationCtx,
  args: CreateFailedDraftFromImageAnalysisArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  const now = Date.now();
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId,
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

export async function deleteOrphanedDraftHandler(
  ctx: MutationCtx,
  args: { draftId: Id<"aiExpenseDrafts"> },
) {
  const { groupId } = await requireGroupMembership(ctx);
  await deleteDraftAndItems(ctx, args.draftId, groupId);
}

export async function deleteDraftsByUserBatchHandler(
  ctx: MutationCtx,
  args: DeleteDraftsByUserBatchArgs,
) {
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 100);
  const drafts = await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", args.groupId))
    .order("asc")
    .take(limit);

  let deletedDraftCount = 0;
  let deletedItemCount = 0;

  for (const draft of drafts) {
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", args.groupId).eq("draftId", draft._id),
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

export async function createE2eReadyDraftForUserHandler(
  ctx: MutationCtx,
  args: CreateE2eReadyDraftForUserArgs,
) {
  const now = Date.now();
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId: args.groupId,
    sourceType: "image_upload",
    status: "ready",
    documentType: "receipt",
    imageFileName: "e2e-issue-179-ready.png",
    shopName: "E2Eスーパー",
    date: "2026-06-01",
    amountYen: 1500,
    categoryId: args.categoryId,
    confidence: {
      documentType: 0.99,
      shopName: 0.99,
      date: 0.99,
      amountYen: 0.99,
      categoryId: 0.99,
    },
    warnings: [],
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
  });

  await insertDraftItems(
    ctx,
    args.groupId,
    draftId,
    [
      {
        itemName: "E2E項目-食料品",
        amountYen: 1000,
        categoryId: args.categoryId,
        confidence: {
          itemName: 0.99,
          amountYen: 0.99,
          categoryId: 0.99,
        },
      },
      {
        itemName: "E2E項目-日用品",
        amountYen: 500,
        confidence: {
          itemName: 0.99,
          amountYen: 0.99,
        },
      },
    ],
    now,
  );

  return draftId;
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
          categoryName: v.optional(v.string()),
          categoryId: v.optional(v.id("categories")),
          confidence: aiExpenseDraftItemConfidenceValidator,
          warnings: v.optional(v.array(v.string())),
        }),
      ),
    ),
  },
  handler: createFromExtractionHandler,
});

export const createFailedDraftFromImageAnalysis = internalMutation({
  args: {
    warning: v.string(),
    imageFileName: v.optional(v.string()),
  },
  handler: createFailedDraftFromImageAnalysisHandler,
});

export const deleteOrphanedDraft = internalMutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: deleteOrphanedDraftHandler,
});

export const deleteDraftsByUserBatch = internalMutation({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  handler: deleteDraftsByUserBatchHandler,
});

export const createE2eReadyDraftForUser = internalMutation({
  args: {
    groupId: v.id("groups"),
    categoryId: v.id("categories"),
  },
  handler: createE2eReadyDraftForUserHandler,
});

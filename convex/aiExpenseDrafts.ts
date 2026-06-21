import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import {
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
  aiExpenseDraftStatusValidator,
} from "./aiExpenseDraftsModel";

export {
  createFromExtractionHandler,
  createFailedDraftFromImageAnalysisHandler,
  deleteOrphanedDraftHandler,
  deleteDraftsByUserBatchHandler,
  createE2eReadyDraftForUserHandler,
} from "./aiExpenseDrafts/internal";

export { listByStatusHandler, getWithItemsHandler } from "./aiExpenseDrafts/queries";

export {
  deleteDraftHandler,
  updateForReviewHandler,
  registerReadyDraftsHandler,
  registerReadyDraftsAsExpenseEntriesHandler,
} from "./aiExpenseDrafts/mutations";

export { analyzeReceiptImageToDraftHandler } from "./aiExpenseDrafts/actions";

import {
  createFromExtractionHandler,
  createFailedDraftFromImageAnalysisHandler,
  deleteOrphanedDraftHandler,
  deleteDraftsByUserBatchHandler,
  createE2eReadyDraftForUserHandler,
} from "./aiExpenseDrafts/internal";
import { listByStatusHandler, getWithItemsHandler } from "./aiExpenseDrafts/queries";
import {
  deleteDraftHandler,
  updateForReviewHandler,
  registerReadyDraftsHandler,
  registerReadyDraftsAsExpenseEntriesHandler,
} from "./aiExpenseDrafts/mutations";
import { analyzeReceiptImageToDraftHandler } from "./aiExpenseDrafts/actions";

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

export const deleteDraft = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: deleteDraftHandler,
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

export const listByStatus = query({
  args: {
    status: aiExpenseDraftStatusValidator,
  },
  handler: listByStatusHandler,
});

export const getWithItems = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getWithItemsHandler,
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

export const analyzeReceiptImageToDraft = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: analyzeReceiptImageToDraftHandler,
});

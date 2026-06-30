import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  aiExpenseDraftConfidenceValidator,
  aiExpenseDraftDocumentTypeValidator,
  aiExpenseDraftItemConfidenceValidator,
  aiExpenseDraftReviewReasonValidator,
} from "../../lib/convex/aiExpenseDrafts/validators";
import {
  createFailedDraftFromImageAnalysisHandler,
  createFromExtractionHandler,
  deleteOrphanedDraftHandler,
} from "../../lib/convex/aiExpenseDrafts/createFromExtraction";
import {
  createE2eReadyDraftForUserHandler,
  deleteDraftsByUserBatchHandler,
} from "../../lib/convex/aiExpenseDrafts/e2eDraftFixtures";

export { deleteDraftAndItems } from "../../lib/convex/aiExpenseDrafts/draftRepository";
export {
  createFromExtractionHandler,
  createFailedDraftFromImageAnalysisHandler,
  deleteOrphanedDraftHandler,
} from "../../lib/convex/aiExpenseDrafts/createFromExtraction";
export {
  deleteDraftsByUserBatchHandler,
  createE2eReadyDraftForUserHandler,
} from "../../lib/convex/aiExpenseDrafts/e2eDraftFixtures";
export type {
  CreateFromExtractionArgs,
  CreateFailedDraftFromImageAnalysisArgs,
} from "../../lib/convex/aiExpenseDrafts/createFromExtraction";
export type {
  DeleteDraftsByUserBatchArgs,
  CreateE2eReadyDraftForUserArgs,
} from "../../lib/convex/aiExpenseDrafts/e2eDraftFixtures";

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
    secondaryCategoryId: v.optional(v.id("categories")),
  },
  handler: createE2eReadyDraftForUserHandler,
});

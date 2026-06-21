import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";

export type {
  CreateBatchArgs,
  RetryImageJobArgs,
  CancelImageJobArgs,
} from "./receiptAnalysisJobs/mutations";
export type { AnalyzeImageJobArgs } from "./receiptAnalysisJobs/actions";

export {
  listBatchesHandler,
  listJobsHandler,
  listJobsByBatchHandler,
  getJobByDraftIdHandler,
} from "./receiptAnalysisJobs/queries";

export {
  createBatchHandler,
  retryImageJobHandler,
  cancelImageJobHandler,
} from "./receiptAnalysisJobs/mutations";

export {
  updateJobStatusHandler,
  incrementBatchProcessedCountHandler,
  finalizeBatchStatusHandler,
  getJobByIdHandler,
  deleteReceiptAnalysisDataByUserBatchHandler,
} from "./receiptAnalysisJobs/internal";

export { analyzeImageJobHandler } from "./receiptAnalysisJobs/actions";

import {
  listBatchesHandler,
  listJobsHandler,
  listJobsByBatchHandler,
  getJobByDraftIdHandler,
} from "./receiptAnalysisJobs/queries";
import {
  createBatchHandler,
  retryImageJobHandler,
  cancelImageJobHandler,
} from "./receiptAnalysisJobs/mutations";
import {
  updateJobStatusHandler,
  incrementBatchProcessedCountHandler,
  finalizeBatchStatusHandler,
  getJobByIdHandler,
  deleteReceiptAnalysisDataByUserBatchHandler,
} from "./receiptAnalysisJobs/internal";
import { analyzeImageJobHandler } from "./receiptAnalysisJobs/actions";

const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("needs_review"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const createBatch = mutation({
  args: {
    fileNames: v.array(v.string()),
  },
  handler: createBatchHandler,
});

export const listBatches = query({
  args: {},
  handler: listBatchesHandler,
});

export const listJobs = query({
  args: {},
  handler: listJobsHandler,
});

export const listJobsByBatch = query({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: listJobsByBatchHandler,
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
    status: jobStatusValidator,
    draftId: v.optional(v.id("aiExpenseDrafts")),
    error: v.optional(v.string()),
  },
  handler: updateJobStatusHandler,
});

export const incrementBatchProcessedCount = internalMutation({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: incrementBatchProcessedCountHandler,
});

export const finalizeBatchStatus = internalMutation({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: finalizeBatchStatusHandler,
});

export const getJobById = internalQuery({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
  },
  handler: getJobByIdHandler,
});

export const getJobByDraftId = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getJobByDraftIdHandler,
});

export const analyzeImageJob = action({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
    imageDataUrl: v.string(),
  },
  handler: analyzeImageJobHandler,
});

export const retryImageJob = mutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
  },
  handler: retryImageJobHandler,
});

export const cancelImageJob = mutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
  },
  handler: cancelImageJobHandler,
});

export const deleteReceiptAnalysisDataByUserBatch = internalMutation({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  handler: deleteReceiptAnalysisDataByUserBatchHandler,
});

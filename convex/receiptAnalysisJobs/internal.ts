import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { deleteDraftAndItems } from "../../lib/convex/aiExpenseDrafts/draftRepository";

type DeleteReceiptAnalysisDataByUserBatchArgs = {
  groupId: Id<"groups">;
  limit?: number;
};

export async function updateJobStatusHandler(
  ctx: MutationCtx,
  args: {
    jobId: Id<"receiptAnalysisImageJobs">;
    status: "running" | "ready" | "needs_review" | "failed";
    draftId?: Id<"aiExpenseDrafts">;
    error?: string;
  },
) {
  const job = await ctx.db.get(args.jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }

  if (job.status === "cancelled") {
    if (args.draftId !== undefined) {
      await deleteDraftAndItems(ctx, args.draftId, job.groupId);
    }
    return;
  }

  const patch: Partial<Doc<"receiptAnalysisImageJobs">> = {
    status: args.status,
    updatedAt: Date.now(),
  };
  if (args.draftId !== undefined) patch.draftId = args.draftId;
  if (args.error !== undefined) patch.error = args.error;

  await ctx.db.patch(args.jobId, patch);
}

export async function incrementBatchProcessedCountHandler(
  ctx: MutationCtx,
  args: { batchId: Id<"receiptAnalysisBatches"> },
) {
  const batch = await ctx.db.get(args.batchId);
  if (!batch) {
    throw new ConvexError("Batch not found");
  }

  await ctx.db.patch(args.batchId, {
    processedCount: batch.processedCount + 1,
    status: "running",
    updatedAt: Date.now(),
  });
}

export async function finalizeBatchStatusHandler(
  ctx: MutationCtx,
  args: { batchId: Id<"receiptAnalysisBatches"> },
) {
  const batch = await ctx.db.get(args.batchId);
  if (!batch) return;

  if (batch.processedCount < batch.totalCount) return;

  const jobs = await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_batch_id", (q) => q.eq("batchId", args.batchId))
    .collect();

  const hasFailed = jobs.some((j) => j.status === "failed");
  const hasRunningOrQueued = jobs.some((j) => j.status === "running" || j.status === "queued");

  if (hasRunningOrQueued) return;

  const status: Doc<"receiptAnalysisBatches">["status"] = hasFailed
    ? "partially_failed"
    : "completed";
  await ctx.db.patch(args.batchId, {
    status,
    updatedAt: Date.now(),
  });
}

export async function getJobByIdHandler(
  ctx: QueryCtx,
  { jobId }: { jobId: Id<"receiptAnalysisImageJobs"> },
) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }
  return job;
}

export async function deleteReceiptAnalysisDataByUserBatchHandler(
  ctx: MutationCtx,
  args: DeleteReceiptAnalysisDataByUserBatchArgs,
) {
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 100);
  const batches = await ctx.db
    .query("receiptAnalysisBatches")
    .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", args.groupId))
    .order("asc")
    .take(limit);

  let deletedBatchCount = 0;
  let deletedJobCount = 0;

  for (const batch of batches) {
    const jobs = await ctx.db
      .query("receiptAnalysisImageJobs")
      .withIndex("by_batch_id", (q) => q.eq("batchId", batch._id))
      .take(100);
    for (const job of jobs) {
      await ctx.db.delete(job._id);
      deletedJobCount += 1;
    }
    await ctx.db.delete(batch._id);
    deletedBatchCount += 1;
  }

  return {
    deletedBatchCount,
    deletedJobCount,
    hasMore: batches.length === limit,
  };
}

const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("needs_review"),
  v.literal("failed"),
  v.literal("cancelled"),
);

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

export const deleteReceiptAnalysisDataByUserBatch = internalMutation({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  handler: deleteReceiptAnalysisDataByUserBatchHandler,
});

import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { deleteDraftAndItems } from "../../lib/convex/aiExpenseDrafts/draftRepository";
import { isTerminalImageJobStatus } from "../../lib/domain/receiptAnalysisJobs/status";

export { isTerminalImageJobStatus } from "../../lib/domain/receiptAnalysisJobs/status";

export async function getBatchByIdHandler(
  ctx: QueryCtx,
  { batchId }: { batchId: Id<"receiptAnalysisBatches"> },
) {
  return await ctx.db.get(batchId);
}

export async function countNeedsReviewJobsByBatchIdHandler(
  ctx: QueryCtx,
  { batchId }: { batchId: Id<"receiptAnalysisBatches"> },
): Promise<number> {
  const jobs = await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_batch_id", (q) => q.eq("batchId", batchId))
    .collect();

  return jobs.filter((job) => job.status === "needs_review").length;
}

export async function scheduleAiReviewNotificationIfNeeded(
  ctx: MutationCtx,
  { batchId, status }: { batchId: Id<"receiptAnalysisBatches">; status: string },
) {
  if (!isTerminalImageJobStatus(status)) {
    return;
  }

  const batch = await ctx.db.get(batchId);
  if (!batch || batch.aiReviewNotificationScheduledAt) {
    return;
  }

  const now = Date.now();
  await ctx.db.patch(batchId, {
    aiReviewNotificationScheduledAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(
    60 * 60 * 1000,
    internal.receiptAnalysisJobs.actions.checkAiReviewRequired,
    {
      batchId,
    },
  );
}

type DeleteReceiptAnalysisDataByUserBatchArgs = {
  groupId: Id<"groups">;
  userId: string;
  limit?: number;
};

export async function updateJobStatusHandler(
  ctx: MutationCtx,
  args: {
    jobId: Id<"receiptAnalysisImageJobs">;
    status: "running" | "ready" | "needs_review" | "failed";
    draftId?: Id<"aiExpenseDrafts">;
    error?: string;
    expectedDraftId?: Id<"aiExpenseDrafts"> | null;
  },
) {
  const job = await ctx.db.get(args.jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }

  if (args.expectedDraftId !== undefined && (job.draftId ?? null) !== args.expectedDraftId) {
    return { applied: false };
  }

  if (job.status === "cancelled") {
    if (args.draftId !== undefined) {
      await deleteDraftAndItems(ctx, args.draftId, job.groupId);
    }
    return { applied: false };
  }

  const patch: Partial<Doc<"receiptAnalysisImageJobs">> = {
    status: args.status,
    updatedAt: Date.now(),
  };
  if (args.draftId !== undefined) patch.draftId = args.draftId;
  if (args.error !== undefined) patch.error = args.error;

  await ctx.db.patch(args.jobId, patch);

  await scheduleAiReviewNotificationIfNeeded(ctx, { batchId: job.batchId, status: args.status });
  return { applied: true };
}

export async function finalizeAnalysisAttemptHandler(
  ctx: MutationCtx,
  args: {
    jobId: Id<"receiptAnalysisImageJobs">;
    expectedDraftId: Id<"aiExpenseDrafts"> | null;
    newDraftId: Id<"aiExpenseDrafts">;
    status: "ready" | "needs_review" | "failed";
    error?: string;
  },
) {
  const job = await ctx.db.get(args.jobId);
  if (!job) {
    throw new ConvexError("Job not found");
  }

  const isStale = (job.draftId ?? null) !== args.expectedDraftId;
  if (job.status === "cancelled" || isStale) {
    if (job.draftId !== args.newDraftId) {
      await deleteDraftAndItems(ctx, args.newDraftId, job.groupId);
    }
    return { applied: false };
  }

  const patch: Partial<Doc<"receiptAnalysisImageJobs">> = {
    status: args.status,
    error: args.error,
    updatedAt: Date.now(),
  };
  if (args.status === "failed" && args.expectedDraftId !== null) {
    await deleteDraftAndItems(ctx, args.newDraftId, job.groupId);
  } else {
    patch.draftId = args.newDraftId;
  }
  await ctx.db.patch(args.jobId, patch);

  if (
    args.status !== "failed" &&
    args.expectedDraftId !== null &&
    args.expectedDraftId !== args.newDraftId
  ) {
    await deleteDraftAndItems(ctx, args.expectedDraftId, job.groupId);
  }
  await scheduleAiReviewNotificationIfNeeded(ctx, { batchId: job.batchId, status: args.status });
  return { applied: true };
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
    .withIndex("by_group_id_and_created_by_user_id", (q) =>
      q.eq("groupId", args.groupId).eq("createdByUserId", args.userId),
    )
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
    expectedDraftId: v.optional(v.union(v.id("aiExpenseDrafts"), v.null())),
  },
  handler: updateJobStatusHandler,
});

export const finalizeAnalysisAttempt = internalMutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
    expectedDraftId: v.union(v.id("aiExpenseDrafts"), v.null()),
    newDraftId: v.id("aiExpenseDrafts"),
    status: v.union(v.literal("ready"), v.literal("needs_review"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: finalizeAnalysisAttemptHandler,
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

export const getBatchById = internalQuery({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: getBatchByIdHandler,
});

export const countNeedsReviewJobsByBatchId = internalQuery({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: countNeedsReviewJobsByBatchIdHandler,
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
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: deleteReceiptAnalysisDataByUserBatchHandler,
});

import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups";
import { deleteDraftAndItems } from "./internal";

export type CreateBatchArgs = {
  fileNames: string[];
};

export type RetryImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
};

export type CancelImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
};

export async function createBatchHandler(
  ctx: MutationCtx,
  args: CreateBatchArgs,
): Promise<{ batch: Doc<"receiptAnalysisBatches">; jobs: Doc<"receiptAnalysisImageJobs">[] }> {
  const { groupId } = await requireGroupMembership(ctx);
  const now = Date.now();
  const totalCount = args.fileNames.length;

  if (totalCount === 0) {
    throw new ConvexError("At least one image file is required");
  }

  const batchId = await ctx.db.insert("receiptAnalysisBatches", {
    groupId,
    totalCount,
    processedCount: 0,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  });

  const jobs: Doc<"receiptAnalysisImageJobs">[] = [];
  for (let i = 0; i < args.fileNames.length; i++) {
    const jobId = await ctx.db.insert("receiptAnalysisImageJobs", {
      batchId,
      groupId,
      imageIndex: i,
      fileName: args.fileNames[i],
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
    const job = await ctx.db.get(jobId);
    if (job) {
      jobs.push(job);
    }
  }

  const batch = await ctx.db.get(batchId);
  if (!batch) {
    throw new ConvexError("Batch was not found after creation");
  }
  return { batch, jobs };
}

export async function retryImageJobHandler(ctx: MutationCtx, args: RetryImageJobArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const job = await ctx.db.get(args.jobId);
  if (!job || job.groupId !== groupId) {
    throw new ConvexError("Job not found");
  }
  if (job.status !== "failed") {
    throw new ConvexError("Only failed jobs can be retried");
  }

  await ctx.db.patch(args.jobId, {
    status: "queued",
    error: undefined,
    updatedAt: Date.now(),
  });
}

export async function cancelImageJobHandler(ctx: MutationCtx, args: CancelImageJobArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const job = await ctx.db.get(args.jobId);
  if (!job || job.groupId !== groupId) {
    throw new ConvexError("Job not found");
  }
  if (job.status === "ready" || job.status === "needs_review") {
    throw new ConvexError("Ready jobs must be removed from the draft queue");
  }
  if (job.draftId !== undefined) {
    await deleteDraftAndItems(ctx, job.draftId, job.groupId);
  }

  await ctx.db.patch(args.jobId, {
    status: "cancelled",
    error: undefined,
    draftId: undefined,
    updatedAt: Date.now(),
  });
}

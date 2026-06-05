import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { extractReceiptFieldsHandler } from "./receiptImageExtraction";
import { requireAuthenticatedUserId } from "./users";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("needs_review"),
  v.literal("failed"),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateBatchArgs = {
  fileNames: string[];
};

export type AnalyzeImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
  imageDataUrl: string;
};

export type RetryImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
};

// ---------------------------------------------------------------------------
// Create batch
// ---------------------------------------------------------------------------

export async function createBatchHandler(
  ctx: MutationCtx,
  args: CreateBatchArgs,
): Promise<{ batch: Doc<"receiptAnalysisBatches">; jobs: Doc<"receiptAnalysisImageJobs">[] }> {
  const userId = await requireAuthenticatedUserId(ctx);
  const now = Date.now();
  const totalCount = args.fileNames.length;

  if (totalCount === 0) {
    throw new ConvexError("At least one image file is required");
  }

  const batchId = await ctx.db.insert("receiptAnalysisBatches", {
    userId,
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
      userId,
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

export const createBatch = mutation({
  args: {
    fileNames: v.array(v.string()),
  },
  handler: createBatchHandler,
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listBatchesHandler(ctx: QueryCtx) {
  const userId = await requireAuthenticatedUserId(ctx);
  return await ctx.db
    .query("receiptAnalysisBatches")
    .withIndex("by_user_id_and_created_at", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);
}

export const listBatches = query({
  args: {},
  handler: listBatchesHandler,
});

export async function listJobsHandler(ctx: QueryCtx) {
  const userId = await requireAuthenticatedUserId(ctx);
  return await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_user_id_and_status", (q) => q.eq("userId", userId))
    .order("desc")
    .take(100);
}

export const listJobs = query({
  args: {},
  handler: listJobsHandler,
});

export async function listJobsByBatchHandler(
  ctx: QueryCtx,
  { batchId }: { batchId: Id<"receiptAnalysisBatches"> },
) {
  const userId = await requireAuthenticatedUserId(ctx);
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.userId !== userId) {
    throw new ConvexError("Batch not found");
  }
  return await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_batch_id", (q) => q.eq("batchId", batchId))
    .order("asc")
    .take(50);
}

export const listJobsByBatch = query({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: listJobsByBatchHandler,
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

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

  const patch: Partial<Doc<"receiptAnalysisImageJobs">> = {
    status: args.status,
    updatedAt: Date.now(),
  };
  if (args.draftId !== undefined) patch.draftId = args.draftId;
  if (args.error !== undefined) patch.error = args.error;

  await ctx.db.patch(args.jobId, patch);
}

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
    status: jobStatusValidator,
    draftId: v.optional(v.id("aiExpenseDrafts")),
    error: v.optional(v.string()),
  },
  handler: updateJobStatusHandler,
});

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

export const incrementBatchProcessedCount = internalMutation({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: incrementBatchProcessedCountHandler,
});

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

export const finalizeBatchStatus = internalMutation({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: finalizeBatchStatusHandler,
});

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

export const getJobById = internalQuery({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
  },
  handler: getJobByIdHandler,
});

export async function getJobByDraftIdHandler(
  ctx: QueryCtx,
  { draftId }: { draftId: Id<"aiExpenseDrafts"> },
) {
  const userId = await requireAuthenticatedUserId(ctx);
  const job = await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_draft_id", (q) => q.eq("draftId", draftId))
    .unique();
  if (!job || job.userId !== userId) {
    return null;
  }
  return job;
}

export const getJobByDraftId = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getJobByDraftIdHandler,
});

// ---------------------------------------------------------------------------
// Action: analyze image job
// ---------------------------------------------------------------------------

export async function analyzeImageJobHandler(ctx: ActionCtx, args: AnalyzeImageJobArgs) {
  const consent: { hasAcceptedExternalApiConsent: boolean } = await ctx.runQuery(
    api.users.getReceiptImageConsent,
    {},
  );
  if (!consent.hasAcceptedExternalApiConsent) {
    throw new ConvexError("Receipt image external API consent is required");
  }

  await ctx.runMutation(internal.receiptAnalysisJobs.updateJobStatus, {
    jobId: args.jobId,
    status: "running",
  });

  const job = await ctx.runQuery(internal.receiptAnalysisJobs.getJobById, { jobId: args.jobId });

  const isRetry = job.draftId !== undefined;

  if (isRetry && job.draftId) {
    await ctx.runMutation(internal.aiExpenseDrafts.deleteOrphanedDraft, {
      draftId: job.draftId,
    });
  }

  let draft: Doc<"aiExpenseDrafts">;
  let jobFailed = false;
  try {
    const extracted = await extractReceiptFieldsHandler(ctx, { imageDataUrl: args.imageDataUrl });

    let categoryId = undefined;
    if (extracted.categoryName && extracted.categoryName.trim().length > 0) {
      const categories = await ctx.runQuery(api.categories.listActive, {});
      const targetName = extracted.categoryName.trim();
      const matched = categories.find((cat) => cat.name === targetName);
      if (matched) {
        categoryId = matched._id;
      }
    }

    draft = await ctx.runMutation(internal.aiExpenseDrafts.createFromExtraction, {
      documentType: extracted.documentType,
      shopName: extracted.shopName || undefined,
      paymentPlace: extracted.paymentPlace || undefined,
      payeeName: extracted.payeeName || undefined,
      paymentPurpose: extracted.paymentPurpose || undefined,
      date: extracted.date || undefined,
      amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
      categoryId,
      imageFileName: job.fileName,
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
    });
  } catch (err) {
    jobFailed = true;
    const safeError = err instanceof Error ? err.message : "画像解析に失敗しました";
    draft = await ctx.runMutation(internal.aiExpenseDrafts.createFailedDraftFromImageAnalysis, {
      warning: safeError,
      imageFileName: job.fileName,
    });
    await ctx.runMutation(internal.receiptAnalysisJobs.updateJobStatus, {
      jobId: args.jobId,
      status: "failed",
      draftId: draft._id,
      error: safeError,
    });
  }

  if (!jobFailed) {
    await ctx.runMutation(internal.receiptAnalysisJobs.updateJobStatus, {
      jobId: args.jobId,
      status: draft.status as "ready" | "needs_review",
      draftId: draft._id,
    });
  }

  if (!isRetry) {
    await ctx.runMutation(internal.receiptAnalysisJobs.incrementBatchProcessedCount, {
      batchId: job.batchId,
    });
  }
  await ctx.runMutation(internal.receiptAnalysisJobs.finalizeBatchStatus, {
    batchId: job.batchId,
  });
}

export const analyzeImageJob = action({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
    imageDataUrl: v.string(),
  },
  handler: analyzeImageJobHandler,
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

export async function retryImageJobHandler(ctx: MutationCtx, args: RetryImageJobArgs) {
  const userId = await requireAuthenticatedUserId(ctx);
  const job = await ctx.db.get(args.jobId);
  if (!job || job.userId !== userId) {
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

export const retryImageJob = mutation({
  args: {
    jobId: v.id("receiptAnalysisImageJobs"),
  },
  handler: retryImageJobHandler,
});

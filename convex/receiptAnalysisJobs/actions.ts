import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  analyzeReceiptImageToDraftCore,
  assertReceiptImageConsent,
  getSafeFailureWarning,
} from "../../lib/convex/receiptImageExtraction/analyzeReceiptImageCore";
import { getExtractorMode } from "../../lib/convex/receiptImageExtraction/mode";
import { snapshotReceiptDraftValues } from "../../lib/convex/aiExpenseDrafts/receiptDataContract";
import type { ReceiptUserOverrideSnapshot } from "../../lib/domain/aiExpenseDrafts/receiptDataContract";

export type CheckAiReviewRequiredArgs = {
  batchId: Id<"receiptAnalysisBatches">;
};

export type AnalyzeImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
  imageDataUrl: string;
};

export async function analyzeImageJobHandler(ctx: ActionCtx, args: AnalyzeImageJobArgs) {
  await assertReceiptImageConsent(ctx);

  const group: { _id: Id<"groups"> } | null = await ctx.runQuery(api.groups.queries.getMyGroup, {});
  if (!group) {
    throw new ConvexError("グループを選択してください");
  }
  const job = await ctx.runQuery(internal.receiptAnalysisJobs.internal.getJobById, {
    jobId: args.jobId,
  });
  if (job.groupId !== group._id) {
    throw new ConvexError("Job not found");
  }

  const startResult = await ctx.runMutation(internal.receiptAnalysisJobs.internal.updateJobStatus, {
    jobId: args.jobId,
    status: "running",
    expectedDraftId: job.draftId ?? null,
  });
  if (startResult?.applied === false) {
    return;
  }

  const appEnv = process.env.APP_ENV ?? "development";
  if (getExtractorMode(appEnv) === "mock") {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const isRetry = job.draftId !== undefined;
  const existingDraftBundle =
    isRetry && job.draftId
      ? await ctx.runQuery(internal.aiExpenseDrafts.internal.getForReanalysis, {
          draftId: job.draftId,
          groupId: group._id,
        })
      : null;
  const existingDraft = existingDraftBundle?.draft ?? null;
  const preservedUserOverride: ReceiptUserOverrideSnapshot<Id<"categories">> | undefined =
    existingDraft?.receiptUserOverride ??
    (existingDraft?.receiptTotalResolution?.candidates.some(
      (candidate) => candidate.source === "user_confirmed",
    )
      ? {
          source: "user",
          updatedAt: existingDraft.updatedAt,
          fields: ["amountYen", "receiptTotalResolution"],
          values: snapshotReceiptDraftValues(existingDraft, existingDraftBundle?.items ?? []),
        }
      : undefined);

  let draft: Doc<"aiExpenseDrafts">;
  let jobFailed = false;
  try {
    draft = await analyzeReceiptImageToDraftCore(ctx, {
      imageDataUrl: args.imageDataUrl,
      imageFileName: job.fileName,
      telemetryId: String(args.jobId),
      preservedUserOverride,
    });
    if (draft.status === "failed") {
      jobFailed = true;
    }
  } catch (err) {
    jobFailed = true;
    const safeError = getSafeFailureWarning(err);
    draft = await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createFailedDraftFromImageAnalysis,
      {
        warning: safeError,
        imageFileName: job.fileName,
      },
    );
  }

  const finalization = await ctx.runMutation(
    internal.receiptAnalysisJobs.internal.finalizeAnalysisAttempt,
    {
      jobId: args.jobId,
      expectedDraftId: job.draftId ?? null,
      newDraftId: draft._id,
      status: jobFailed ? "failed" : (draft.status as "ready" | "needs_review"),
      error: jobFailed ? (draft.warnings?.[0] ?? "画像解析に失敗しました") : undefined,
    },
  );
  if (finalization?.applied === false) {
    return;
  }

  if (!isRetry) {
    await ctx.runMutation(internal.receiptAnalysisJobs.internal.incrementBatchProcessedCount, {
      batchId: job.batchId,
    });
  }
  await ctx.runMutation(internal.receiptAnalysisJobs.internal.finalizeBatchStatus, {
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

export async function checkAiReviewRequiredHandler(
  ctx: ActionCtx,
  { batchId }: CheckAiReviewRequiredArgs,
): Promise<void> {
  const batch = await ctx.runQuery(internal.receiptAnalysisJobs.internal.getBatchById, { batchId });
  if (!batch || !batch.createdByUserId) {
    return;
  }

  const pendingCount = await ctx.runQuery(
    internal.receiptAnalysisJobs.internal.countNeedsReviewJobsByBatchId,
    { batchId },
  );

  if (pendingCount === 0) {
    return;
  }

  const user = await ctx.runQuery(internal.users.internal.getUserById, {
    userId: batch.createdByUserId,
  });
  if (!user?.email) {
    return;
  }

  await ctx.runMutation(internal.email.jobs.enqueueTransactionalEmailJob, {
    templateType: "ai_review_required",
    payloadJson: JSON.stringify({ pendingCount }),
    recipientEmail: user.email,
  });
}

export const checkAiReviewRequired = internalAction({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: checkAiReviewRequiredHandler,
});

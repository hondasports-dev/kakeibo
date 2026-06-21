import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { extractReceiptFieldsHandler } from "../receiptImageExtraction/extraction";

export type AnalyzeImageJobArgs = {
  jobId: Id<"receiptAnalysisImageJobs">;
  imageDataUrl: string;
};

export async function analyzeImageJobHandler(ctx: ActionCtx, args: AnalyzeImageJobArgs) {
  const consent: { hasAcceptedExternalApiConsent: boolean } = await ctx.runQuery(
    api.users.getReceiptImageConsent,
    {},
  );
  if (!consent.hasAcceptedExternalApiConsent) {
    throw new ConvexError("Receipt image external API consent is required");
  }

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

  await ctx.runMutation(internal.receiptAnalysisJobs.internal.updateJobStatus, {
    jobId: args.jobId,
    status: "running",
  });

  const isRetry = job.draftId !== undefined;

  if (isRetry && job.draftId) {
    await ctx.runMutation(internal.aiExpenseDrafts.internal.deleteOrphanedDraft, {
      draftId: job.draftId,
    });
  }

  let draft: Doc<"aiExpenseDrafts">;
  let jobFailed = false;
  try {
    const extracted = await extractReceiptFieldsHandler(ctx, { imageDataUrl: args.imageDataUrl });

    let categoryId = undefined;
    if (extracted.categoryName && extracted.categoryName.trim().length > 0) {
      const categories: Doc<"categories">[] = await ctx.runQuery(api.categories.listActive, {});
      const targetName = extracted.categoryName.trim();
      const matched = categories.find((cat) => cat.name === targetName);
      if (matched) {
        categoryId = matched._id;
      }
    }

    draft = await ctx.runMutation(internal.aiExpenseDrafts.internal.createFromExtraction, {
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
    draft = await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createFailedDraftFromImageAnalysis,
      {
        warning: safeError,
        imageFileName: job.fileName,
      },
    );
    await ctx.runMutation(internal.receiptAnalysisJobs.internal.updateJobStatus, {
      jobId: args.jobId,
      status: "failed",
      draftId: draft._id,
      error: safeError,
    });
  }

  if (!jobFailed) {
    await ctx.runMutation(internal.receiptAnalysisJobs.internal.updateJobStatus, {
      jobId: args.jobId,
      status: draft.status as "ready" | "needs_review",
      draftId: draft._id,
    });
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

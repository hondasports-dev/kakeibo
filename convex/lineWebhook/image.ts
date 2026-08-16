import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { mapExtractionToDraftArgs } from "../../lib/domain/aiExpenseDrafts/extractionMapping";
import { toImageDataUrl } from "../../lib/domain/lineImage/content";
import {
  LINE_IMAGE_CONSENT_REQUIRED_MESSAGE,
  LINE_IMAGE_FETCH_FAILED_MESSAGE,
  LINE_IMAGE_INVALID_MESSAGE,
  LINE_IMAGE_TOO_LARGE_MESSAGE,
  buildLineImageReviewUrl,
  formatLineImageAnalysisFailedReply,
  formatLineImageDraftCreatedReply,
} from "../../lib/domain/lineImage/reply";
import {
  LINE_NO_GROUP_MESSAGE,
  LINE_UNRESOLVED_GROUP_MESSAGE,
} from "../../lib/domain/lineSummary/reply";
import { getSafeFailureWarning } from "../../lib/convex/receiptImageExtraction/analyzeReceiptImageCore";
import { extractReceiptFieldsFromImage } from "../receiptImageExtraction/extraction";
import { LINE_UNLINKED_GUIDANCE_MESSAGE, getLineMessageContent, sendLineTextReply } from "./client";
import type { LineImageSkipReason } from "./model";

const GUIDE_RETRY_DELAY_MS = 1_000;
const MAX_GUIDE_RETRIES = 2;
const LINE_IMAGE_FILE_NAME = "line-receipt.jpg";

type ProcessLinkedImageArgs = {
  replyToken: string;
  userId: string;
  webhookEventId: string;
  messageId: string;
  attempt?: number;
};

type ImageJobSnapshot = {
  status: "pending" | "drafted" | "failed" | "skipped";
  skipReason?: LineImageSkipReason;
  draftId?: Id<"aiExpenseDrafts">;
};

function replyForSkipReason(reason: LineImageSkipReason): string {
  switch (reason) {
    case "unlinked":
      return LINE_UNLINKED_GUIDANCE_MESSAGE;
    case "no_consent":
      return LINE_IMAGE_CONSENT_REQUIRED_MESSAGE;
    case "no_group":
      return LINE_NO_GROUP_MESSAGE;
    case "unresolved_group":
      return LINE_UNRESOLVED_GROUP_MESSAGE;
    case "invalid_image":
      return LINE_IMAGE_INVALID_MESSAGE;
    case "too_large":
      return LINE_IMAGE_TOO_LARGE_MESSAGE;
    case "fetch_failed":
      return LINE_IMAGE_FETCH_FAILED_MESSAGE;
  }
}

function replyForCompletedJob(job: ImageJobSnapshot): string {
  const reviewUrl = buildLineImageReviewUrl();
  if (job.status === "drafted") {
    return formatLineImageDraftCreatedReply(reviewUrl);
  }
  if (job.status === "failed") {
    return formatLineImageAnalysisFailedReply(reviewUrl);
  }
  if (job.status === "skipped" && job.skipReason) {
    return replyForSkipReason(job.skipReason);
  }
  return LINE_IMAGE_FETCH_FAILED_MESSAGE;
}

async function skipJob(
  ctx: ActionCtx,
  webhookEventId: string,
  skipReason: LineImageSkipReason,
): Promise<string> {
  await ctx.runMutation(internal.lineWebhook.internal.markImageJobSkipped, {
    webhookEventId,
    skipReason,
  });
  return replyForSkipReason(skipReason);
}

async function createDraftFromImage(
  ctx: ActionCtx,
  args: {
    userId: string;
    imageDataUrl: string;
    categories: Array<{ _id: Id<"categories">; name: string; description?: string }>;
  },
): Promise<Doc<"aiExpenseDrafts">> {
  try {
    const extracted = await extractReceiptFieldsFromImage({
      imageDataUrl: args.imageDataUrl,
      categories: args.categories.map((category) => ({
        name: category.name,
        description: category.description,
      })),
    });
    const draftArgs = mapExtractionToDraftArgs(extracted, args.categories, LINE_IMAGE_FILE_NAME);
    return await ctx.runMutation(internal.aiExpenseDrafts.internal.createFromExtractionForUser, {
      userId: args.userId,
      ...draftArgs,
    });
  } catch (error) {
    return await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createFailedDraftFromImageAnalysisForUser,
      {
        userId: args.userId,
        warning: getSafeFailureWarning(error),
        imageFileName: LINE_IMAGE_FILE_NAME,
      },
    );
  }
}

export async function buildLinkedImageReply(
  ctx: ActionCtx,
  args: ProcessLinkedImageArgs,
  getContent: typeof getLineMessageContent = getLineMessageContent,
): Promise<string> {
  const job = await ctx.runQuery(internal.lineWebhook.internal.getImageJob, {
    webhookEventId: args.webhookEventId,
  });
  if (job === null) {
    return LINE_IMAGE_FETCH_FAILED_MESSAGE;
  }
  if (job.status !== "pending") {
    return replyForCompletedJob(job);
  }

  const context = await ctx.runQuery(internal.lineWebhook.internal.loadImageProcessingContext, {
    userId: args.userId,
  });
  if (!context.hasUniqueActiveLink) {
    return await skipJob(ctx, args.webhookEventId, "unlinked");
  }

  let content;
  try {
    content = await getContent(args.messageId);
  } catch {
    return await skipJob(ctx, args.webhookEventId, "fetch_failed");
  }

  const dataUrl = toImageDataUrl(content);
  if (!dataUrl.ok) {
    return await skipJob(
      ctx,
      args.webhookEventId,
      dataUrl.error === "too_large" ? "too_large" : "invalid_image",
    );
  }

  if (!context.hasConsent) {
    return await skipJob(ctx, args.webhookEventId, "no_consent");
  }
  if (context.groupStatus === "no_group") {
    return await skipJob(ctx, args.webhookEventId, "no_group");
  }
  if (context.groupStatus !== "resolved" || context.groupId === undefined) {
    return await skipJob(ctx, args.webhookEventId, "unresolved_group");
  }

  const draft = await createDraftFromImage(ctx, {
    userId: args.userId,
    imageDataUrl: dataUrl.dataUrl,
    categories: context.categories,
  });
  if (draft.status === "failed") {
    await ctx.runMutation(internal.lineWebhook.internal.markImageJobFailed, {
      webhookEventId: args.webhookEventId,
      draftId: draft._id,
    });
    return formatLineImageAnalysisFailedReply(buildLineImageReviewUrl());
  }

  await ctx.runMutation(internal.lineWebhook.internal.markImageJobDrafted, {
    webhookEventId: args.webhookEventId,
    draftId: draft._id,
  });
  return formatLineImageDraftCreatedReply(buildLineImageReviewUrl());
}

export async function processLinkedImageHandler(
  ctx: ActionCtx,
  args: ProcessLinkedImageArgs,
  getContent: typeof getLineMessageContent = getLineMessageContent,
) {
  const attempt = args.attempt ?? 0;
  try {
    const replyText = await buildLinkedImageReply(ctx, args, getContent);
    if (args.replyToken) {
      await sendLineTextReply(args.replyToken, replyText);
    }
  } catch {
    if (attempt < MAX_GUIDE_RETRIES) {
      await ctx.scheduler.runAfter(
        GUIDE_RETRY_DELAY_MS,
        internal.lineWebhook.image.processLinkedImage,
        {
          replyToken: args.replyToken,
          userId: args.userId,
          webhookEventId: args.webhookEventId,
          messageId: args.messageId,
          attempt: attempt + 1,
        },
      );
    }
  }
  return null;
}

export const processLinkedImage = internalAction({
  args: {
    replyToken: v.string(),
    userId: v.string(),
    webhookEventId: v.string(),
    messageId: v.string(),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: processLinkedImageHandler,
});

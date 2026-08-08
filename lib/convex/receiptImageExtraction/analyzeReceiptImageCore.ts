import { ConvexError } from "convex/values";
import { api, internal } from "../../../convex/_generated/api";
import type { ActionCtx } from "../../../convex/_generated/server";
import type { Doc } from "../../../convex/_generated/dataModel";
import { mapExtractionToDraftArgs } from "../../../lib/domain/aiExpenseDrafts/extractionMapping";
import { extractReceiptFieldsHandler } from "../../../convex/receiptImageExtraction/extraction";

export type AnalyzeReceiptImageCoreArgs = {
  imageDataUrl: string;
  imageFileName?: string;
};

export function getSafeFailureWarning(err: unknown) {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "画像解析に失敗しました";
}

export async function assertReceiptImageConsent(ctx: ActionCtx) {
  const consent: { hasAcceptedExternalApiConsent: boolean } = await ctx.runQuery(
    api.users.queries.getReceiptImageConsent,
    {},
  );
  if (!consent.hasAcceptedExternalApiConsent) {
    throw new ConvexError("Receipt image external API consent is required");
  }
}

export async function analyzeReceiptImageToDraftCore(
  ctx: ActionCtx,
  args: AnalyzeReceiptImageCoreArgs,
): Promise<Doc<"aiExpenseDrafts">> {
  let categories: Doc<"categories">[];
  let extracted;
  try {
    categories = await ctx.runQuery(api.categories.queries.listActive, {});
    extracted = await extractReceiptFieldsHandler(ctx, {
      imageDataUrl: args.imageDataUrl,
      categories: categories.map((category) => ({
        name: category.name,
        description: category.description,
      })),
    });
  } catch (err) {
    return await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createFailedDraftFromImageAnalysis,
      {
        warning: getSafeFailureWarning(err),
        imageFileName: args.imageFileName,
      },
    );
  }

  return await ctx.runMutation(
    internal.aiExpenseDrafts.internal.createFromExtraction,
    mapExtractionToDraftArgs(extracted, categories, args.imageFileName),
  );
}

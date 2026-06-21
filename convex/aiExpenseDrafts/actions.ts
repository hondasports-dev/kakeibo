import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "../categoryCandidate";
import { extractReceiptFieldsHandler } from "../receiptImageExtraction/extraction";

type AnalyzeReceiptImageToDraftArgs = {
  imageDataUrl: string;
};

function getSafeFailureWarning(err: unknown) {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "画像解析に失敗しました";
}

export async function analyzeReceiptImageToDraftHandler(
  ctx: ActionCtx,
  args: AnalyzeReceiptImageToDraftArgs,
): Promise<Doc<"aiExpenseDrafts">> {
  const consent: { hasAcceptedExternalApiConsent: boolean } = await ctx.runQuery(
    api.users.getReceiptImageConsent,
    {},
  );
  if (!consent.hasAcceptedExternalApiConsent) {
    throw new ConvexError("Receipt image external API consent is required");
  }

  let extracted;
  try {
    extracted = await extractReceiptFieldsHandler(ctx, args);
  } catch (err) {
    const draft: Doc<"aiExpenseDrafts"> = await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createFailedDraftFromImageAnalysis,
      {
        warning: getSafeFailureWarning(err),
      },
    );
    return draft;
  }

  // カテゴリ候補を生成し、AI が推定したカテゴリ名を候補の中で解決する。
  // - コンビニ払込票では paymentPlace を主根拠にせず paymentPurpose / payeeName を優先する。
  // - 候補にないカテゴリ名は採用しない（存在しないカテゴリIDを保存しない）。
  const categories = await ctx.runQuery(api.categories.listActive, {});
  const candidates = buildCategoryCandidates({
    documentType: extracted.documentType,
    categoryName: extracted.categoryName,
    shopName: extracted.shopName || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    categories,
  });
  const categoryId = resolveCategoryIdFromCandidates(extracted.categoryName, candidates);

  const draft: Doc<"aiExpenseDrafts"> = await ctx.runMutation(
    internal.aiExpenseDrafts.internal.createFromExtraction,
    {
      documentType: extracted.documentType,
      shopName: extracted.shopName || undefined,
      paymentPlace: extracted.paymentPlace || undefined,
      payeeName: extracted.payeeName || undefined,
      paymentPurpose: extracted.paymentPurpose || undefined,
      date: extracted.date || undefined,
      amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
      categoryId,
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
    },
  );
  return draft;
}

export const analyzeReceiptImageToDraft = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: analyzeReceiptImageToDraftHandler,
});

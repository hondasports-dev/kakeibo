import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAuthenticatedUserId } from "../users/auth";
import { api } from "../_generated/api";
import { getMockResult } from "../../lib/convex/receiptImageExtraction/mock";
import { getExtractorMode } from "../../lib/convex/receiptImageExtraction/mode";
import { callOpenAIReceiptExtractor } from "../../lib/convex/receiptImageExtraction/openaiClient";
import type {
  ExtractReceiptFieldsArgs,
  ExtractReceiptFieldsResult,
  ReceiptCategoryHint,
} from "../../lib/convex/receiptImageExtraction/types";
import { validateImageDataUrl } from "../../lib/convex/receiptImageExtraction/validators";

export type {
  ExtractionConfidence,
  ExtractReceiptFieldsResult,
  ExtractReceiptItemResult,
} from "../../lib/convex/receiptImageExtraction/types";

export {
  validateImageDataUrl,
  validateExtractedDate,
} from "../../lib/convex/receiptImageExtraction/validators";
export { parseOpenAIResponse } from "../../lib/convex/receiptImageExtraction/parseExtraction";
export { getMockResult } from "../../lib/convex/receiptImageExtraction/mock";
export { getExtractorMode } from "../../lib/convex/receiptImageExtraction/mode";

export async function extractReceiptFieldsHandler(
  ctx: ActionCtx,
  args: ExtractReceiptFieldsArgs,
): Promise<ExtractReceiptFieldsResult> {
  // 解析処理自体は認証のみ確認する。公開 action 側で所属グループの有効カテゴリを解決する。
  await requireAuthenticatedUserId(ctx);

  const { imageDataUrl } = args;

  // imageDataUrl バリデーション
  validateImageDataUrl(imageDataUrl);

  const appEnv = process.env.APP_ENV ?? "development";
  const mode = getExtractorMode(appEnv);

  // real モードのガード: production 以外では実行不可
  if (mode === "real" && appEnv !== "production") {
    throw new ConvexError(
      `real モードは APP_ENV=production のときのみ利用できます（現在: ${appEnv}）`,
    );
  }

  // mock モード
  if (mode === "mock") {
    return getMockResult();
  }

  // real モード: OPENAI_API_KEY チェック
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConvexError(
      "OPENAI_API_KEY が設定されていません。Convex Dashboard で環境変数を設定してください",
    );
  }

  return callOpenAIReceiptExtractor({
    imageDataUrl,
    apiKey,
    categoryNames: args.categoryNames ?? [],
    categories: args.categories,
  });
}

export const extractReceiptFields = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args): Promise<ExtractReceiptFieldsResult> => {
    const categories: Doc<"categories">[] = await ctx.runQuery(
      api.categories.queries.listActive,
      {},
    );
    return extractReceiptFieldsHandler(ctx, {
      ...args,
      categories: categories.map<ReceiptCategoryHint>((category) => ({
        name: category.name,
        description: category.description,
      })),
    });
  },
});

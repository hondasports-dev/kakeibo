import type { ActionCtx } from "../_generated/server";
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
  // 解析処理自体は認証のみ確認する。公開 action 側で所属グループの有効カテゴリと同意を解決する。
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
  });
}

export const extractReceiptFields = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args): Promise<ExtractReceiptFieldsResult> => {
    // 公開 action 側でグループ所属と外部 API 同意を確認する。
    const group = await ctx.runQuery(api.groups.queries.getMyGroup, {});
    if (group === null) {
      throw new ConvexError("グループを選択してください");
    }
    const [consent, categories] = await Promise.all([
      ctx.runQuery(api.users.queries.getReceiptImageConsent, {}),
      ctx.runQuery(api.categories.queries.listActive, {}),
    ]);
    if (!consent.hasAcceptedExternalApiConsent) {
      throw new ConvexError("Receipt image external API consent is required");
    }
    return extractReceiptFieldsHandler(ctx, {
      ...args,
      categoryNames: categories.map((category) => category.name),
    });
  },
});

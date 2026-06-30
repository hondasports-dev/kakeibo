import { v } from "convex/values";
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  analyzeReceiptImageToDraftCore,
  assertReceiptImageConsent,
} from "../../lib/convex/receiptImageExtraction/analyzeReceiptImageCore";

type AnalyzeReceiptImageToDraftArgs = {
  imageDataUrl: string;
};

export async function analyzeReceiptImageToDraftHandler(
  ctx: ActionCtx,
  args: AnalyzeReceiptImageToDraftArgs,
): Promise<Doc<"aiExpenseDrafts">> {
  await assertReceiptImageConsent(ctx);
  return await analyzeReceiptImageToDraftCore(ctx, args);
}

export const analyzeReceiptImageToDraft = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: analyzeReceiptImageToDraftHandler,
});

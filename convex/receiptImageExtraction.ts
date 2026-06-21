import { action } from "./_generated/server";
import { v } from "convex/values";

export type {
  ExtractionConfidence,
  ExtractReceiptFieldsResult,
} from "./receiptImageExtraction/extraction";

export { extractReceiptFieldsHandler } from "./receiptImageExtraction/extraction";

import { extractReceiptFieldsHandler } from "./receiptImageExtraction/extraction";

export const extractReceiptFields = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return extractReceiptFieldsHandler(ctx, args);
  },
});

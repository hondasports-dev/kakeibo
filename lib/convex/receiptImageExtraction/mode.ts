import { ConvexError } from "convex/values";
import { resolveExtractorMode } from "../../../lib/domain/receiptImageExtraction/mode";

export function getExtractorMode(appEnv: string): "mock" | "real" {
  const mode = process.env.RECEIPT_IMAGE_EXTRACTOR_MODE;
  const result = resolveExtractorMode({ appEnv, mode });

  if ("error" in result) {
    if (result.error === "missing_required") {
      throw new ConvexError("RECEIPT_IMAGE_EXTRACTOR_MODE を production では必ず設定してください");
    }
    throw new ConvexError(
      "RECEIPT_IMAGE_EXTRACTOR_MODE は mock または real のどちらかを指定してください",
    );
  }

  return result.mode;
}

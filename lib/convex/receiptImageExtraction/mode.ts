import { ConvexError } from "convex/values";

export function getExtractorMode(appEnv: string): "mock" | "real" {
  const mode = process.env.RECEIPT_IMAGE_EXTRACTOR_MODE;
  if (mode === undefined || mode === "") {
    if (appEnv === "production") {
      throw new ConvexError("RECEIPT_IMAGE_EXTRACTOR_MODE を production では必ず設定してください");
    }
    return "mock";
  }
  if (mode !== "mock" && mode !== "real") {
    throw new ConvexError(
      "RECEIPT_IMAGE_EXTRACTOR_MODE は mock または real のどちらかを指定してください",
    );
  }
  return mode;
}

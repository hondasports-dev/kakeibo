export type ExtractorMode = "mock" | "real";

export type ResolveExtractorModeError = "missing_required" | "invalid";

const extractorModeErrorMessages: Record<ResolveExtractorModeError, string> = {
  missing_required: "RECEIPT_IMAGE_EXTRACTOR_MODE を production では必ず設定してください",
  invalid: "RECEIPT_IMAGE_EXTRACTOR_MODE は mock または real のどちらかを指定してください",
};

/** レシート画像抽出モード解決エラーをユーザー向けメッセージに変換する */
export function getResolveExtractorModeErrorMessage(error: ResolveExtractorModeError): string {
  return extractorModeErrorMessages[error];
}

export function resolveExtractorMode(args: {
  appEnv: string;
  mode?: string;
}): { mode: ExtractorMode } | { error: ResolveExtractorModeError } {
  if (args.mode === undefined || args.mode === "") {
    if (args.appEnv === "production") {
      return { error: "missing_required" };
    }
    return { mode: "mock" };
  }

  if (args.mode !== "mock" && args.mode !== "real") {
    return { error: "invalid" };
  }

  return { mode: args.mode };
}

export type ReceiptExtractionStage = "openai_http" | "json_parse" | "domain_validation" | "save";

type ReceiptExtractionTelemetry = {
  telemetryId?: string;
  stage: ReceiptExtractionStage;
  durationMs: number;
  outcome: "success" | "failure";
  httpStatus?: number;
  responseStatus?: string;
  incompleteReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  failureKind?: string;
  failureDetail?: string;
};

/** レシート本文・画像を含めない、段階別の構造化ログ。 */
export function logReceiptExtractionStage(event: ReceiptExtractionTelemetry) {
  console.info("receipt_extraction_stage", event);
}

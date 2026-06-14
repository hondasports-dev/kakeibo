import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HelpIcon from "@mui/icons-material/Help";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import type { AiExpenseQueueDocumentType, AiExpenseQueueStatus, QueueSectionKey } from "./types";

export const statusLabels: Record<AiExpenseQueueStatus, string> = {
  adding: "追加中",
  queued: "解析待ち",
  analyzing: "解析中",
  ready: "登録準備OK",
  needs_review: "確認が必要",
  failed: "失敗",
  registering: "登録中",
  registered: "登録済み",
};

export const documentTypeLabels: Record<AiExpenseQueueDocumentType, string> = {
  receipt: "レシート",
  convenience_payment: "払込票",
  unknown: "種別未判定",
};

export const reviewDocumentTypeOptions = Object.entries(documentTypeLabels).filter(
  ([value]) => value !== "unknown",
);

const reviewReasonLabels: Record<string, string> = {
  low_confidence: "信頼度が低い項目があります",
  missing_required_field: "必須項目を確認してください",
  ambiguous_document_type: "書類種別を確認してください",
  ambiguous_category: "カテゴリを確認してください",
  amount_mismatch: "明細合計と合計金額が一致しません",
  parse_failed: "画像解析に失敗しました",
};

export function getReviewReasonLabel(reason: string) {
  return reviewReasonLabels[reason] ?? reason;
}

export function getSectionKey(status: AiExpenseQueueStatus): QueueSectionKey {
  if (status === "ready") {
    return "ready";
  }
  if (status === "needs_review") {
    return "needs_review";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "registered") {
    return "registered";
  }
  return "processing";
}

export function getStatusIcon(status: AiExpenseQueueStatus) {
  if (status === "ready" || status === "registered") {
    return <CheckCircleIcon fontSize="small" />;
  }
  if (status === "needs_review") {
    return <HelpIcon fontSize="small" />;
  }
  if (status === "failed") {
    return <ErrorOutlinedIcon fontSize="small" />;
  }
  return <HourglassEmptyIcon fontSize="small" />;
}

export function getStatusColor(status: AiExpenseQueueStatus) {
  if (status === "ready" || status === "registered") {
    return "success" as const;
  }
  if (status === "needs_review") {
    return "warning" as const;
  }
  if (status === "failed") {
    return "error" as const;
  }
  return "default" as const;
}

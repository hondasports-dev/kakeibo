import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HelpIcon from "@mui/icons-material/Help";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import type {
  AiExpenseQueueDocumentType,
  AiExpenseQueueStatus,
  QueueSectionKey,
} from "../types/types";

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
  low_confidence: "低信頼度",
  missing_required_field: "必須項目不足",
  ambiguous_document_type: "書類種別要確認",
  ambiguous_category: "未分類あり",
  amount_mismatch: "金額不一致",
  parse_failed: "解析失敗",
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

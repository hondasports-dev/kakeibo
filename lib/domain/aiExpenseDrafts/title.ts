import type { AiExpenseDraftDocumentType } from "./constants";

export type DraftTitleInput = {
  documentType?: AiExpenseDraftDocumentType;
  shopName?: string;
  payeeName?: string;
  paymentPurpose?: string;
  paymentPlace?: string;
};

function joinNonEmpty(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" ");
}

/**
 * AI 下書きの一覧/レビュー表示用タイトルを解決する。
 * 払込票の場合は支払先・目的を優先し、それ以外は店名を優先する。
 */
export function getDraftTitle(draft: DraftTitleInput, fallback = "AI支出下書き"): string {
  if (draft.documentType === "convenience_payment") {
    return (
      joinNonEmpty([draft.payeeName, draft.paymentPurpose]) ||
      draft.shopName?.trim() ||
      draft.paymentPlace?.trim() ||
      fallback
    );
  }

  return (
    draft.shopName?.trim() || draft.payeeName?.trim() || draft.paymentPlace?.trim() || fallback
  );
}

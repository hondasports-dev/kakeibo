import type { AiExpenseDraftDocumentType } from "./constants";

type ReceiptShopNameDraftFields = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
};

function joinNonEmpty(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" ");
}

export function resolveReceiptShopNameFromDraft(draft: ReceiptShopNameDraftFields) {
  if (draft.documentType === "convenience_payment") {
    return (
      joinNonEmpty([draft.payeeName, draft.paymentPurpose]) ||
      draft.paymentPlace?.trim() ||
      draft.shopName?.trim() ||
      "不明"
    );
  }

  return draft.shopName?.trim() || draft.payeeName?.trim() || draft.paymentPlace?.trim() || "不明";
}

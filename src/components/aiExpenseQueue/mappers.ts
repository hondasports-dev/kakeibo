import type { Id } from "../../../convex/_generated/dataModel";
import type {
  AiExpenseDraft,
  AiExpenseDraftWithItems,
  AiExpenseQueueItem,
  AiExpenseQueueStatus,
  ReviewFormValues,
} from "./types";

export const emptyReviewForm: ReviewFormValues = {
  documentType: "receipt",
  shopName: "",
  paymentPlace: "",
  payeeName: "",
  paymentPurpose: "",
  date: "",
  amountYen: "",
  categoryId: "",
};

function resolveDraftTitle(draft: AiExpenseDraft) {
  if (draft.documentType === "convenience_payment") {
    return (
      [draft.payeeName, draft.paymentPurpose, draft.paymentPlace].find(Boolean) ?? "AI支出下書き"
    );
  }
  return draft.shopName || draft.payeeName || draft.paymentPlace || "AI支出下書き";
}

export function mapDraftToQueueItem(
  draft: AiExpenseDraft,
  statusOverrides: Partial<Record<string, AiExpenseQueueStatus>>,
  categories?: Array<{ _id: Id<"categories"> | string; name: string }>,
): AiExpenseQueueItem {
  const categoryName = categories?.find((c) => c._id === draft.categoryId)?.name;
  return {
    id: draft._id,
    fileName: draft.imageFileName ?? "AI支出下書き",
    status: statusOverrides[draft._id] ?? draft.status,
    documentType: draft.documentType,
    title: resolveDraftTitle(draft),
    amountYen: draft.amountYen,
    date: draft.date,
    categoryName,
    reviewReasons: draft.reviewReasons,
  };
}

export function mapDraftToReviewForm(draft: AiExpenseDraft): ReviewFormValues {
  return {
    documentType: draft.documentType,
    shopName: draft.shopName ?? "",
    paymentPlace: draft.paymentPlace ?? "",
    payeeName: draft.payeeName ?? "",
    paymentPurpose: draft.paymentPurpose ?? "",
    date: draft.date ?? "",
    amountYen: draft.amountYen?.toString() ?? "",
    categoryId: draft.categoryId ?? "",
  };
}

export function isDraftWithItems(value: unknown): value is AiExpenseDraftWithItems {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    typeof (value as { draft?: unknown }).draft === "object"
  );
}

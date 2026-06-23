import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  AiExpenseDraft,
  AiExpenseDraftWithItems,
  AiExpenseQueueItem,
  AiExpenseQueueStatus,
  ReviewFormValues,
} from "../types/types";

export const emptyReviewForm: ReviewFormValues = {
  documentType: "receipt",
  shopName: "",
  date: "",
  amountYen: "",
  categoryId: "",
};

function resolveDraftTitle(draft: AiExpenseDraft) {
  if (draft.documentType === "convenience_payment") {
    const paymentDescription = [draft.payeeName, draft.paymentPurpose]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");
    return (
      paymentDescription || draft.shopName?.trim() || draft.paymentPlace?.trim() || "AI支出下書き"
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
  const paymentDescription =
    draft.documentType === "convenience_payment"
      ? [draft.payeeName, draft.paymentPurpose]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(" ")
      : "";
  const shopName =
    paymentDescription ||
    draft.shopName?.trim() ||
    draft.payeeName?.trim() ||
    draft.paymentPlace?.trim() ||
    "";

  return {
    documentType: draft.documentType,
    shopName,
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

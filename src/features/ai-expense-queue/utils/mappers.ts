import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  AiExpenseDraft,
  AiExpenseDraftWithItems,
  AiExpenseQueueItem,
  AiExpenseQueueStatus,
  ReviewFormValues,
  ReviewItemValues,
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
  const categoryAggregates = draft.itemSummary?.categoryAggregates.map((aggregate) => ({
    ...aggregate,
    categoryName: categories?.find((category) => category._id === aggregate.categoryId)?.name,
  }));
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
    itemTotalYen: draft.itemSummary?.itemTotalYen,
    itemDifferenceYen: draft.itemSummary?.itemDifferenceYen,
    hasUncategorizedItems: draft.itemSummary?.hasUncategorizedItems,
    hasLowConfidenceItems: draft.itemSummary?.hasLowConfidenceItems,
    categoryAggregates,
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

export function mapDraftItemsToReviewItems(
  items: AiExpenseDraftWithItems["items"],
): ReviewItemValues[] {
  return items.map((item, index) => ({
    id: item._id ?? `item-${index}`,
    itemName: item.itemName,
    amountYen: (item.normalizedAmountYen ?? item.amountYen).toString(),
    printedAmountYen: item.printedAmountYen,
    amountBasis: item.amountBasis,
    taxRatePercent: item.taxRatePercent,
    taxMarker: item.taxMarker,
    markers: item.markers,
    allocatedTaxYen: item.allocatedTaxYen,
    normalizedAmountYen: item.normalizedAmountYen,
    taxResolutionStatus: item.taxResolutionStatus,
    taxResolutionSource: item.taxResolutionSource,
    taxReviewReasons: item.taxReviewReasons,
    quantity: item.quantity,
    unitPriceYen: item.unitPriceYen,
    categoryId: item.categoryId ?? "",
    confidence: item.confidence,
    warnings: item.warnings,
  }));
}

export function isDraftWithItems(value: unknown): value is AiExpenseDraftWithItems {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    typeof (value as { draft?: unknown }).draft === "object"
  );
}

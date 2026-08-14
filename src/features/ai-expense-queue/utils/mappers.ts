import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { getImageCaptureFailureHint } from "../../../../lib/domain/aiExpenseDrafts/failure";
import { getDraftTitle } from "../../../../lib/domain/aiExpenseDrafts/title";
import { resolveReviewItemDisplayAmountYen } from "../../../../lib/domain/aiExpenseDrafts/reviewItemAmounts";
import type {
  AiExpenseDraft,
  AiExpenseDraftStatus,
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

export function mapDraftToQueueItem(
  draft: AiExpenseDraft,
  statusOverrides: Partial<Record<string, AiExpenseQueueStatus>>,
  categories?: Array<{ _id: Id<"categories"> | string; name: string }>,
  previewImageDataUrl?: string,
): AiExpenseQueueItem {
  const categoryName = categories?.find((c) => c._id === draft.categoryId)?.name;
  const categoryAggregates = draft.itemSummary?.categoryAggregates.map((aggregate) => ({
    ...aggregate,
    categoryName: categories?.find((category) => category._id === aggregate.categoryId)?.name,
  }));
  return {
    id: draft._id,
    fileName: draft.imageFileName ?? "AI支出下書き",
    previewImageDataUrl,
    failureHint: getImageCaptureFailureHint(draft.status as AiExpenseDraftStatus),
    status: statusOverrides[draft._id] ?? draft.status,
    documentType: draft.documentType,
    title: getDraftTitle(draft),
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

export function mapConvexDraftToAiExpenseDraft(draft: Doc<"aiExpenseDrafts">): AiExpenseDraft {
  return {
    _id: draft._id,
    status: draft.status as AiExpenseDraftStatus,
    documentType: draft.documentType,
    imageFileName: draft.imageFileName,
    shopName: draft.shopName,
    paymentPlace: draft.paymentPlace,
    payeeName: draft.payeeName,
    paymentPurpose: draft.paymentPurpose,
    date: draft.date,
    amountYen: draft.amountYen,
    categoryId: draft.categoryId,
    reviewReasons: draft.reviewReasons,
    warnings: draft.warnings,
    taxSummaries: draft.taxSummaries,
    markerDefinitions: draft.markerDefinitions,
  };
}

export function mapDraftToReviewForm(draft: AiExpenseDraft): ReviewFormValues {
  return {
    documentType: draft.documentType,
    shopName: getDraftTitle(draft, ""),
    date: draft.date ?? "",
    amountYen: draft.amountYen?.toString() ?? "",
    categoryId: draft.categoryId ?? "",
  };
}

export function mapDraftItemsToReviewItems(
  items: AiExpenseDraftWithItems["items"],
): ReviewItemValues[] {
  return items.map((item, index) => {
    const displayAmountYen = resolveReviewItemDisplayAmountYen(item);

    return {
      id: item._id ?? `item-${index}`,
      persistedItemId: item._id,
      itemName: item.itemName,
      amountYen: displayAmountYen.toString(),
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
    };
  });
}

export function isDraftWithItems(value: unknown): value is AiExpenseDraftWithItems {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    typeof (value as { draft?: unknown }).draft === "object"
  );
}

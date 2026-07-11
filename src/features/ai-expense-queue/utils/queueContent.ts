import type { AiExpenseQueueItem } from "../types/types";

export function reviewPriority(item: AiExpenseQueueItem) {
  const reasons = item.reviewReasons ?? [];
  if (reasons.includes("amount_mismatch") || (item.itemDifferenceYen ?? 0) !== 0) return 0;
  if (reasons.includes("ambiguous_category") || item.hasUncategorizedItems) return 1;
  return 2;
}

export function getQueueContentSummary({
  groupedItems,
  readyItems,
  selectedReadyIds,
}: {
  groupedItems: {
    processing: AiExpenseQueueItem[];
    ready: AiExpenseQueueItem[];
    needs_review: AiExpenseQueueItem[];
    failed: AiExpenseQueueItem[];
    registered: AiExpenseQueueItem[];
  };
  readyItems: AiExpenseQueueItem[];
  selectedReadyIds: string[];
}) {
  const needsReviewCount = groupedItems.needs_review.length;
  const processingCount = groupedItems.processing.length;
  const failedCount = groupedItems.failed.length;
  const selectedReadyItems = readyItems.filter((item) => selectedReadyIds.includes(item.id));
  const prioritizedReviewItems = [...groupedItems.needs_review].sort(
    (left, right) => reviewPriority(left) - reviewPriority(right),
  );
  const firstReviewItem = prioritizedReviewItems[0];
  const selectedTotalAmountYen = selectedReadyItems.reduce(
    (total, item) => total + (item.amountYen ?? 0),
    0,
  );

  return {
    failedCount,
    firstReviewItem,
    needsReviewCount,
    prioritizedReviewItems,
    processingCount,
    selectedTotalAmountYen,
  };
}

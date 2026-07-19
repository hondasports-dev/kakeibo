import type { AiExpenseQueueCategory, ReviewFormValues, ReviewItemValues } from "../types/types";
import { formatYen } from "../../../utils/currency";

const LOW_CONFIDENCE_THRESHOLD = 0.8;

export type CategoryAggregateDisplay = {
  categoryId: string;
  categoryName: string;
  amountYen: number;
};

export function isLowConfidenceItem(item: ReviewItemValues): boolean {
  const confidence = item.confidence;
  if (!confidence) {
    return false;
  }
  return (
    (confidence.itemName ?? 1) < LOW_CONFIDENCE_THRESHOLD ||
    (confidence.amountYen ?? 1) < LOW_CONFIDENCE_THRESHOLD ||
    (confidence.categoryId ?? confidence.categoryName ?? 1) < LOW_CONFIDENCE_THRESHOLD
  );
}

export function hasUncategorizedItems(reviewItems: ReviewItemValues[]): boolean {
  return reviewItems.some((item) => !item.categoryId);
}

export function hasLowConfidenceItems(reviewItems: ReviewItemValues[]): boolean {
  return reviewItems.some(isLowConfidenceItem);
}

export function computeItemTotalYen(reviewItems: ReviewItemValues[]): number {
  return reviewItems.reduce((sum, item) => sum + (Number(item.amountYen) || 0), 0);
}

export function computeCategoryAggregates(
  reviewItems: ReviewItemValues[],
  categories: AiExpenseQueueCategory[],
): CategoryAggregateDisplay[] {
  const totals = new Map<string, number>();

  for (const item of reviewItems) {
    if (!item.categoryId) {
      continue;
    }
    const amountYen = Number(item.amountYen) || 0;
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + amountYen);
  }

  return [...totals.entries()].map(([categoryId, amountYen]) => ({
    categoryId,
    categoryName: categories.find((category) => category._id === categoryId)?.name ?? "カテゴリ",
    amountYen,
  }));
}

export function getReviewAttentionLabels({
  receiptAmountYen,
  reviewItems,
}: {
  receiptAmountYen: number;
  reviewItems: ReviewItemValues[];
}): string[] {
  const labels: string[] = [];

  if (hasUncategorizedItems(reviewItems)) {
    labels.push("未分類の明細があります");
  }
  if (hasLowConfidenceItems(reviewItems)) {
    labels.push("低信頼度の明細があります");
  }

  const itemTotal = computeItemTotalYen(reviewItems);
  if (reviewItems.length > 0 && receiptAmountYen - itemTotal !== 0) {
    labels.push("明細合計と合計金額に差額があります");
  }

  return labels;
}

export function formatReviewDraftHeader({
  date,
  amountYen,
}: Pick<ReviewFormValues, "date" | "amountYen">): string {
  const formattedDate = date ? date.replaceAll("-", "/") : "";
  const amount = Number(amountYen) || 0;
  const formattedAmount = formatYen(amount);

  if (formattedDate && amount > 0) {
    return `${formattedDate} ・ ${formattedAmount}`;
  }
  if (formattedDate) {
    return formattedDate;
  }
  if (amount > 0) {
    return formattedAmount;
  }
  return "";
}

export function resolveReviewShopName(
  reviewForm: ReviewFormValues,
  draftShopName?: string,
): string {
  return reviewForm.shopName.trim() || draftShopName?.trim() || "AI支出下書き";
}

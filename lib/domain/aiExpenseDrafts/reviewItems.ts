import { AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD } from "./constants";

export type ItemConfidence = {
  itemName?: number;
  amountYen?: number;
  categoryName?: number;
  categoryId?: number;
};

export type ReviewItemLike = {
  amountYen: number;
  normalizedAmountYen?: number;
  categoryId?: string;
  confidence: ItemConfidence;
};

export function hasLowConfidenceItem(item: { confidence: ItemConfidence }): boolean {
  return (
    (item.confidence.itemName ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.amountYen ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.categoryId ?? item.confidence.categoryName ?? 1) <
      AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD
  );
}

export type ItemSummary = {
  itemTotalYen: number;
  itemDifferenceYen: number | undefined;
  hasUncategorizedItems: boolean;
  hasLowConfidenceItems: boolean;
  categoryAggregates: Array<{ categoryId: string; amountYen: number }>;
};

export function summarizeItems(
  draft: { amountYen?: number },
  items: ReviewItemLike[],
): ItemSummary | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const categoryAmounts = new Map<string, number>();
  let itemTotalYen = 0;
  let hasUncategorizedItems = false;
  let hasLowConfidenceItems = false;

  for (const item of items) {
    const registrationAmountYen = item.normalizedAmountYen ?? item.amountYen;
    itemTotalYen += registrationAmountYen;
    if (item.categoryId === undefined) {
      hasUncategorizedItems = true;
    } else {
      categoryAmounts.set(
        item.categoryId,
        (categoryAmounts.get(item.categoryId) ?? 0) + registrationAmountYen,
      );
    }
    if (hasLowConfidenceItem(item)) {
      hasLowConfidenceItems = true;
    }
  }

  return {
    itemTotalYen,
    itemDifferenceYen: draft.amountYen === undefined ? undefined : draft.amountYen - itemTotalYen,
    hasUncategorizedItems,
    hasLowConfidenceItems,
    categoryAggregates: Array.from(categoryAmounts.entries()).map(([categoryId, amountYen]) => ({
      categoryId,
      amountYen,
    })),
  };
}

export function validatePositiveCategoryTotals(
  items: Array<{ categoryId: string; amountYen: number }>,
): boolean {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountYen);
  }
  return [...totals.values()].every((amountYen) => amountYen > 0);
}

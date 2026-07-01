import type { ReviewFormValues, ReviewItemValues } from "../types/types";
import { isDiscountItemName, isValidReviewItemAmount } from "./discountItems";
import { computeCategoryAggregates } from "./reviewDialogUtils";

function isValidExpenseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function getReviewFormError(reviewForm: ReviewFormValues): string | null {
  const amountYen = Number(reviewForm.amountYen);
  if (
    !reviewForm.shopName.trim() ||
    !isValidExpenseDate(reviewForm.date) ||
    !Number.isInteger(amountYen) ||
    amountYen <= 0 ||
    !reviewForm.categoryId
  ) {
    return "店名・内容、支出日、金額、カテゴリを確認してください。";
  }
  return null;
}

export function getReviewDocumentTypeError(
  documentType: ReviewFormValues["documentType"],
): string | null {
  if (documentType === "unknown") {
    return "書類種別を選択してください。";
  }
  return null;
}

export function getReviewItemsError(reviewItems: ReviewItemValues[]): string | null {
  const unresolvedDiscount = reviewItems.find(
    (item) => isDiscountItemName(item.itemName) && !item.categoryId,
  );
  if (unresolvedDiscount) {
    return "割引対象の商品を選択してください。";
  }
  const invalidItem = reviewItems.find((item) => {
    const itemAmount = Number(item.amountYen);
    return (
      !item.itemName.trim() ||
      !isValidReviewItemAmount(item.itemName, itemAmount) ||
      !item.categoryId
    );
  });
  if (invalidItem) {
    return "明細名、明細金額、カテゴリを確認してください。";
  }
  return null;
}

export function getReviewCategoryAggregateError(reviewItems: ReviewItemValues[]): string | null {
  if (computeCategoryAggregates(reviewItems, []).some((aggregate) => aggregate.amountYen <= 0)) {
    return "割引後のカテゴリ金額は1円以上にしてください。";
  }
  return null;
}

export function getReviewSubmitError(
  reviewForm: ReviewFormValues,
  reviewItems: ReviewItemValues[],
): string | null {
  return (
    getReviewDocumentTypeError(reviewForm.documentType) ??
    getReviewFormError(reviewForm) ??
    getReviewItemsError(reviewItems) ??
    getReviewCategoryAggregateError(reviewItems)
  );
}

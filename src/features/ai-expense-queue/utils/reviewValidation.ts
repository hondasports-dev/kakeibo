import { isValidIsoDateString } from "../../../../lib/domain/week/weekDates";
import { parseExpenseAmountString } from "../../../../lib/domain/expenseEntries/expenseEntryItem";
import type { ReviewFormValues, ReviewItemValues } from "../types/types";
import { isDiscountItemName, isValidReviewItemAmount } from "./discountItems";
import { computeCategoryAggregates } from "./reviewDialogUtils";

export function getReviewFormError(reviewForm: ReviewFormValues): string | null {
  const amountResult = parseExpenseAmountString(reviewForm.amountYen);
  if (
    !reviewForm.shopName.trim() ||
    !isValidIsoDateString(reviewForm.date) ||
    !amountResult.success ||
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
    (item) => isDiscountItemName(item.itemName) && !item.discountTargetItemId,
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

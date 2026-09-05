import { parseExpenseAmountString } from "../expenseEntries/expenseEntryItem";
import {
  isDiscountLine,
  isValidSignedLineItemAmount,
  type ReceiptItemLineType,
} from "../receipt/discountItems";
import { isValidIsoDateString } from "../week/weekDates";
import type { AiExpenseDraftDocumentType } from "./constants";
import type { AiExpenseRegistrationMode } from "./receiptDataContract";

export type ReviewFormInput = {
  documentType: AiExpenseDraftDocumentType;
  shopName: string;
  date: string;
  amountYen: string;
  categoryId: string;
  registrationMode?: AiExpenseRegistrationMode;
};

export type ReviewItemInput = {
  itemName: string;
  lineType?: ReceiptItemLineType;
  amountYen: string;
  categoryId: string;
  discountTargetItemId?: string;
};

type ReviewCategoryAmountTotal = {
  categoryId: string;
  amountYen: number;
};

function computeCategoryAmountTotals(items: ReviewItemInput[]): ReviewCategoryAmountTotal[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.categoryId) {
      continue;
    }
    const amountYen = Number(item.amountYen) || 0;
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + amountYen);
  }
  return [...totals.entries()].map(([categoryId, amountYen]) => ({ categoryId, amountYen }));
}

/** 書類種別入力エラーをユーザー向けメッセージに変換する。 */
export function getReviewDocumentTypeErrorMessage(
  documentType: AiExpenseDraftDocumentType,
): string | null {
  if (documentType === "unknown") {
    return "書類種別を選択してください。";
  }
  return null;
}

/** レビューフォーム入力エラーをユーザー向けメッセージに変換する。 */
export function getReviewFormErrorMessage(reviewForm: ReviewFormInput): string | null {
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

/** レビュー明細入力エラーをユーザー向けメッセージに変換する。 */
export function getReviewItemsErrorMessage(reviewItems: ReviewItemInput[]): string | null {
  const unresolvedDiscount = reviewItems.find(
    (item) => isDiscountLine(item.itemName, item.lineType) && !item.discountTargetItemId,
  );
  if (unresolvedDiscount) {
    return "割引対象の商品を選択してください。";
  }

  const invalidItem = reviewItems.find((item) => {
    const itemAmount = Number(item.amountYen);
    return (
      !item.itemName.trim() ||
      !isValidSignedLineItemAmount(item.itemName, itemAmount, item.lineType) ||
      !item.categoryId
    );
  });
  if (invalidItem) {
    return "明細名、明細金額、カテゴリを確認してください。";
  }
  return null;
}

/** レビュー明細のカテゴリ別合計金額エラーをユーザー向けメッセージに変換する。 */
export function getReviewCategoryAggregateErrorMessage(
  reviewItems: ReviewItemInput[],
): string | null {
  if (computeCategoryAmountTotals(reviewItems).some((aggregate) => aggregate.amountYen <= 0)) {
    return "割引後のカテゴリ金額は1円以上にしてください。";
  }
  return null;
}

/** レビュー送信前の総合エラーをユーザー向けメッセージに変換する。 */
export function getReviewSubmitErrorMessage(
  reviewForm: ReviewFormInput,
  reviewItems: ReviewItemInput[],
): string | null {
  const formError =
    getReviewDocumentTypeErrorMessage(reviewForm.documentType) ??
    getReviewFormErrorMessage(reviewForm);
  if (formError || reviewForm.registrationMode === "totalOnly") {
    return formError;
  }
  return (
    getReviewItemsErrorMessage(reviewItems) ?? getReviewCategoryAggregateErrorMessage(reviewItems)
  );
}

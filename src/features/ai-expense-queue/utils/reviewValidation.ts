import type { ReviewFormValues } from "../types/types";

export function getReviewFormError(reviewForm: ReviewFormValues): string | null {
  const amountYen = Number(reviewForm.amountYen);
  if (
    !reviewForm.shopName.trim() ||
    !reviewForm.date ||
    !Number.isInteger(amountYen) ||
    amountYen <= 0 ||
    !reviewForm.categoryId
  ) {
    return "店名・内容、日付、金額、カテゴリを確認してください。";
  }
  return null;
}

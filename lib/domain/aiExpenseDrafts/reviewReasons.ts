import { isTaxInterpretationWarning } from "../receipt/tax/draftTaxMapping";
import { AI_EXPENSE_DRAFT_REVIEW_REASONS, type AiExpenseDraftReviewReason } from "./constants";

/** 既存 reviewReasons と新しく計算した reviewReasons を、定義済み順序でマージする */
export function mergeReviewReasons(
  computedReasons: AiExpenseDraftReviewReason[],
  existingReasons: AiExpenseDraftReviewReason[],
): AiExpenseDraftReviewReason[] {
  const reasons = new Set<AiExpenseDraftReviewReason>([...computedReasons, ...existingReasons]);
  return AI_EXPENSE_DRAFT_REVIEW_REASONS.filter((reason) => reasons.has(reason));
}

/** 税処理とは無関係な reviewReasons を抽出する */
export function nonTaxReviewReasons(reviewReasons: AiExpenseDraftReviewReason[]) {
  return reviewReasons.filter(
    (reason) => reason !== "user_confirmation_required" && reason !== "amount_mismatch",
  );
}

/** 税interpretation系の警告でないものを抽出する */
export function filterNonInterpretationWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !isTaxInterpretationWarning(warning));
}

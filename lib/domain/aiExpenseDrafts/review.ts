import { trimOptional } from "../common/string";
import { validateExpenseAmount } from "../expenseEntries/expenseEntryItem";
import { isValidIsoDateString } from "../week/weekDates";
import type { AiExpenseDraftDocumentType } from "./constants";

export type HasCounterpartyArgs = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
};

/** 下書きに対して相手方情報（店舗名・支払先・支払目的等）が存在するか判定する */
export function hasCounterparty(args: HasCounterpartyArgs): boolean {
  if (args.documentType === "convenience_payment") {
    return (
      !!trimOptional(args.shopName) ||
      (!!trimOptional(args.payeeName) && !!trimOptional(args.paymentPurpose))
    );
  }
  return (
    !!trimOptional(args.shopName) ||
    !!trimOptional(args.payeeName) ||
    !!trimOptional(args.paymentPlace)
  );
}

export type ReviewUpdateReadyArgs = HasCounterpartyArgs & {
  date: string;
  amountYen: number;
};

export type ReviewUpdateReadyError =
  | "unknown_document_type"
  | "missing_date"
  | "invalid_date"
  | "invalid_amount"
  | "missing_counterparty";

/** レビュー更新で下書きを ready にできるか検証する */
export function validateReviewUpdateCanBecomeReady(
  args: ReviewUpdateReadyArgs,
): { success: true } | { success: false; error: ReviewUpdateReadyError } {
  if (args.documentType === "unknown") {
    return { success: false, error: "unknown_document_type" };
  }

  const date = trimOptional(args.date);
  if (!date) {
    return { success: false, error: "missing_date" };
  }
  if (!isValidIsoDateString(date)) {
    return { success: false, error: "invalid_date" };
  }

  if (!validateExpenseAmount(args.amountYen).success) {
    return { success: false, error: "invalid_amount" };
  }

  if (!hasCounterparty(args)) {
    return { success: false, error: "missing_counterparty" };
  }

  return { success: true };
}

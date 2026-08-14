import { validateExpenseAmount, validateExpenseTitle } from "./expenseEntryItem";

export type DraftExpenseEntryInput<TId = string> = {
  itemName?: string;
  amountYen: number;
  categoryId?: TId;
};

export type DraftExpenseEntryBuildError = "invalid_amount" | "missing_category" | "invalid_title";

const draftExpenseEntryErrorMessages: Record<DraftExpenseEntryBuildError, string> = {
  invalid_amount: "Amount must be a positive integer",
  missing_category: "Category ID is required",
  invalid_title: "Title is required",
};

/** 下書き明細から expenseEntry 構築エラーをユーザー向けメッセージに変換する */
export function getDraftExpenseEntryErrorMessage(error: DraftExpenseEntryBuildError): string {
  return draftExpenseEntryErrorMessages[error];
}

export type DraftExpenseEntry<TId = string> = {
  amount: number;
  categoryId: TId;
  title: string;
};

/**
 * AI 下書き明細から expenseEntries 作成用の値を構築する。
 * カテゴリは明細の categoryId、なければ下書きの categoryId を fallback とする。
 * タイトルが空なら "不明" を fallback とする。
 */
export function buildDraftExpenseEntry<TId>(
  input: DraftExpenseEntryInput<TId>,
  draftCategoryId?: TId,
):
  | { success: true; entry: DraftExpenseEntry<TId> }
  | { success: false; error: DraftExpenseEntryBuildError } {
  const amountResult = validateExpenseAmount(input.amountYen);
  if (!amountResult.success) {
    return { success: false, error: "invalid_amount" };
  }

  const categoryId = input.categoryId ?? draftCategoryId;
  if (categoryId === undefined) {
    return { success: false, error: "missing_category" };
  }

  const titleResult = validateExpenseTitle(input.itemName ?? "不明");
  if (!titleResult.success) {
    return { success: false, error: "invalid_title" };
  }

  return {
    success: true,
    entry: {
      amount: input.amountYen,
      categoryId,
      title: titleResult.title,
    },
  };
}

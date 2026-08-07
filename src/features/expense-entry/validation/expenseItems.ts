import type { Id } from "../../../../convex/_generated/dataModel";
import {
  EXPENSE_ENTRY_AMOUNT_MAX,
  EXPENSE_ENTRY_MEMO_MAX_LENGTH,
  EXPENSE_ENTRY_TITLE_MAX_LENGTH,
  validateExpenseItemInput,
} from "../../../../lib/domain/expenseEntries/expenseEntryItem";

export type ExpenseItemEntryInput = {
  categoryId: Id<"categories"> | "";
  amountYen: string;
  title: string;
  memo?: string;
};

export type ExpenseItemEntryParsed = {
  categoryId: Id<"categories">;
  amountYen: number;
  title: string;
  memo?: string;
};

export type ExpenseItemEntryErrors = Partial<{
  categoryId: string;
  amountYen: string;
  title: string;
  memo: string;
}>;

export function validateExpenseItemEntry(
  data: ExpenseItemEntryInput,
):
  | { success: true; data: ExpenseItemEntryParsed }
  | { success: false; errors: ExpenseItemEntryErrors } {
  const result = validateExpenseItemInput({
    categoryId: data.categoryId,
    amountYen: data.amountYen,
    title: data.title,
    memo: data.memo,
  });

  if (result.success) {
    return {
      success: true,
      data: {
        categoryId: result.data.categoryId as Id<"categories">,
        amountYen: result.data.amountYen,
        title: result.data.title,
        memo: result.data.memo,
      },
    };
  }

  const errors: ExpenseItemEntryErrors = {};
  if (result.errors.categoryId) {
    errors.categoryId = "カテゴリは必須です";
  }
  if (result.errors.amountYen) {
    const code = result.errors.amountYen;
    errors.amountYen =
      code === "required"
        ? "金額は必須です"
        : code === "not_number"
          ? "金額は数字のみで入力してください"
          : code === "too_large"
            ? `金額は ${EXPENSE_ENTRY_AMOUNT_MAX.toLocaleString("ja-JP")} 円以下です`
            : "金額は 1 円以上です";
  }
  if (result.errors.title) {
    errors.title =
      result.errors.title === "empty"
        ? "内容は必須です"
        : `内容は ${EXPENSE_ENTRY_TITLE_MAX_LENGTH} 文字以内です`;
  }
  if (result.errors.memo) {
    errors.memo = `メモは ${EXPENSE_ENTRY_MEMO_MAX_LENGTH} 文字以内です`;
  }

  return { success: false, errors };
}

export type ValidateExpenseItemsInput = {
  sourceAmount: number | undefined;
  items: ExpenseItemEntryInput[];
};

type ValidateExpenseItemsSuccess = {
  success: true;
  data: {
    items: ExpenseItemEntryParsed[];
    /** 差額 = sourceAmount - items合計。sourceAmountが未指定の場合はnull */
    difference: number | null;
  };
};

type ValidateExpenseItemsFailure =
  | { success: false; reason: "no_items" }
  | { success: false; reason: "item_errors"; itemErrors: ExpenseItemEntryErrors[] }
  | { success: false; reason: "amount_exceeded"; difference: number };

export function validateExpenseItems(
  input: ValidateExpenseItemsInput,
): ValidateExpenseItemsSuccess | ValidateExpenseItemsFailure {
  if (input.items.length === 0) {
    return { success: false, reason: "no_items" };
  }

  // 各項目をバリデーション
  const parsedItems: ExpenseItemEntryParsed[] = [];
  const itemErrors: ExpenseItemEntryErrors[] = [];
  let hasErrors = false;

  for (const item of input.items) {
    const result = validateExpenseItemEntry(item);
    if (result.success) {
      parsedItems.push(result.data);
      itemErrors.push({});
    } else {
      parsedItems.push({ categoryId: "" as Id<"categories">, amountYen: 0, title: "" });
      itemErrors.push(result.errors);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return { success: false, reason: "item_errors", itemErrors };
  }

  // sourceAmount が未指定の場合は差額チェックをスキップ
  if (input.sourceAmount === undefined) {
    return {
      success: true,
      data: { items: parsedItems, difference: null },
    };
  }

  const totalAmount = parsedItems.reduce((sum, item) => sum + item.amountYen, 0);
  const difference = input.sourceAmount - totalAmount;

  // 差額がマイナス（超過）の場合は保存禁止
  if (difference < 0) {
    return { success: false, reason: "amount_exceeded", difference };
  }

  return {
    success: true,
    data: { items: parsedItems, difference },
  };
}

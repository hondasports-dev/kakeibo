import * as v from "valibot";
import type { Id } from "../../convex/_generated/dataModel";

const categoryIdField = v.pipe(v.string(), v.nonEmpty("カテゴリは必須です"));

const amountYenField = v.pipe(
  v.string(),
  v.nonEmpty("金額は必須です"),
  v.regex(/^\d+$/, "金額は数字のみで入力してください"),
  v.transform((s) => parseInt(s, 10)),
  v.minValue(1, "金額は 1 円以上です"),
  v.maxValue(9_999_999, "金額は 9,999,999 円以下です"),
);

const titleField = v.pipe(
  v.string(),
  v.nonEmpty("内容は必須です"),
  v.maxLength(100, "内容は 100 文字以内です"),
);

const memoField = v.optional(
  v.pipe(
    v.string(),
    v.maxLength(500, "メモは 500 文字以内です"),
    v.transform((s) => (s === "" ? undefined : s)),
  ),
);

const expenseItemEntrySchema = v.object({
  categoryId: categoryIdField,
  amountYen: amountYenField,
  title: titleField,
  memo: memoField,
});

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
  const result = v.safeParse(expenseItemEntrySchema, data);
  if (result.success) {
    return { success: true, data: result.output as ExpenseItemEntryParsed };
  }
  const errors: ExpenseItemEntryErrors = {};
  for (const issue of result.issues) {
    const key = issue.path?.[0]?.key as keyof ExpenseItemEntryErrors | undefined;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
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

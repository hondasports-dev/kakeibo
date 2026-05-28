import * as v from "valibot";

/**
 * YYYY-MM-DD 形式の日付文字列が実在する日付かチェックする。
 * 例: "2026-02-30" は false（2月に30日は存在しない）。
 */
function isValidCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const dateField = v.pipe(
  v.string(),
  v.nonEmpty("日付は必須です"),
  v.regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください"),
  v.check(isValidCalendarDate, "存在しない日付です"),
);

const amountYenField = v.pipe(
  v.string(),
  v.nonEmpty("金額は必須です"),
  v.regex(/^\d+$/, "金額は数字のみで入力してください"),
  v.transform((s) => parseInt(s, 10)),
  v.minValue(1, "金額は 1 円以上です"),
  v.maxValue(9_999_999, "金額は 9,999,999 円以下です"),
);

const categoryIdField = v.pipe(v.string(), v.nonEmpty("カテゴリは必須です"));

const memoField = v.optional(
  v.pipe(
    v.string(),
    v.maxLength(500, "メモは 500 文字以内です"),
    // 空文字列は undefined として扱う（Convex に空文字を保存しない）
    v.transform((s) => (s === "" ? undefined : s)),
  ),
);

/**
 * type フィールドで分岐する discriminated union スキーマ。
 * v.variant を使うことで、どちらの variant かを type 値で確定してからバリデーションし、
 * エラーパスを正確に報告できる。
 */
export const receiptFormSchema = v.variant("type", [
  v.object({
    type: v.literal("expense"),
    date: dateField,
    shopName: v.pipe(
      v.string(),
      v.nonEmpty("店舗名は必須です"),
      v.maxLength(100, "店舗名は 100 文字以内です"),
    ),
    amountYen: amountYenField,
    categoryId: categoryIdField,
    memo: memoField,
  }),
  v.object({
    type: v.literal("income"),
    date: dateField,
    bankName: v.pipe(
      v.string(),
      v.nonEmpty("銀行名は必須です"),
      v.maxLength(100, "銀行名は 100 文字以内です"),
    ),
    amountYen: amountYenField,
    categoryId: categoryIdField,
    memo: memoField,
  }),
]);

export type ReceiptFormValues =
  | {
      type: "expense";
      date: string;
      shopName: string;
      amountYen: string;
      categoryId: string;
      memo?: string;
    }
  | {
      type: "income";
      date: string;
      bankName: string;
      amountYen: string;
      categoryId: string;
      memo?: string;
    };

export type ReceiptFormParsed = v.InferOutput<typeof receiptFormSchema>;

export type ReceiptFormErrors = Partial<{
  type: string;
  date: string;
  shopName: string;
  bankName: string;
  amountYen: string;
  categoryId: string;
  memo: string;
}>;

export function validateReceiptForm(
  data: unknown,
): { success: true; data: ReceiptFormParsed } | { success: false; errors: ReceiptFormErrors } {
  const result = v.safeParse(receiptFormSchema, data);
  if (result.success) {
    return { success: true, data: result.output };
  }
  const errors: ReceiptFormErrors = {};
  for (const issue of result.issues) {
    if (!issue.path || issue.path.length === 0) {
      // type フィールドが不正または欠落している場合のトップレベルエラー
      if (!errors.type) {
        errors.type = "支出または収入を選択してください";
      }
      continue;
    }
    const key = issue.path[0]?.key as keyof ReceiptFormErrors | undefined;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return { success: false, errors };
}

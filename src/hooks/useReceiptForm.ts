import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { validateReceiptForm, type ReceiptFormErrors } from "../validation/receipt";
import type { ExtractedReceiptResult } from "../components/ReceiptImageExtractor";
import type { NormalizedReceiptExtraction } from "../validation/receiptExtraction";

type ReceiptFormValues = {
  date: string;
  shopName: string;
  amountYen: string;
  categoryId: Id<"categories"> | "";
  memo: string;
};

type UseReceiptFormArgs = {
  weekStartDate: string;
  weekEndDate: string;
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
};

export function useReceiptForm({ weekStartDate, weekEndDate, categories }: UseReceiptFormArgs) {
  const shopNameRef = useRef<HTMLInputElement>(null);
  const [formValues, setFormValues] = useState<ReceiptFormValues>({
    date: weekStartDate,
    shopName: "",
    amountYen: "",
    categoryId: categories[0]?._id ?? "",
    memo: "",
  });
  const [errors, setErrors] = useState<ReceiptFormErrors>({});
  const [aiFieldStatuses, setAiFieldStatuses] = useState<
    NormalizedReceiptExtraction["fieldStatuses"] | null
  >(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [apiError, setApiError] = useState("");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  const createReceipt = useMutation(api.receipts.createReceipt);

  const firstCategoryId = categories[0]?._id ?? "";
  const selectedCategoryId =
    formValues.categoryId !== "" &&
    categories.some((category) => category._id === formValues.categoryId)
      ? formValues.categoryId
      : firstCategoryId;

  const handleFieldChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    // フィールド変更時にそのフィールドのエラーをクリア
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // フィールド手動編集時に AI候補 状態をクリア
    if (aiFieldStatuses && field in aiFieldStatuses) {
      setAiFieldStatuses((prev) =>
        prev
          ? {
              ...prev,
              [field]: {
                ...prev[field as keyof typeof prev],
                status: "rejected",
              },
            }
          : null,
      );
    }
  };

  const handleExtracted = ({ fields, fieldStatuses }: ExtractedReceiptResult) => {
    const extractedDateIsOutsideWeek =
      fields.date && (fields.date < weekStartDate || fields.date > weekEndDate);

    if (extractedDateIsOutsideWeek) {
      setErrors((prev) => ({
        ...prev,
        date: "読み取った日付はこの週の範囲外です。確認して手入力してください。",
      }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      ...(fields.shopName ? { shopName: fields.shopName } : {}),
      // weekStartDate〜weekEndDate 範囲内であれば日付を反映、範囲外は無視
      date: fields.date ? fields.date : prev.date,
      // amountYen は文字列として保持（カンマ区切り表示のため）
      amountYen:
        fields.amountYen && fields.amountYen > 0 ? String(fields.amountYen) : prev.amountYen,
    }));
    // 反映されたフィールドのバリデーションエラーをクリア
    setErrors((prev) => ({
      ...prev,
      ...(fields.shopName ? { shopName: undefined } : {}),
      ...(fields.amountYen ? { amountYen: undefined } : {}),
      ...(fields.date ? { date: undefined } : {}),
    }));
    // AI候補フィールドのステータスを保存（applied フィールドのみハイライト対象）
    setAiFieldStatuses(fieldStatuses);
  };

  const submitForm = async () => {
    const validation = validateReceiptForm({
      ...formValues,
      categoryId: selectedCategoryId,
    });
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    setStatus("submitting");
    setApiError("");
    try {
      await createReceipt({
        date: validation.data.date,
        shopName: validation.data.shopName,
        amountYen: validation.data.amountYen,
        categoryId: validation.data.categoryId as Id<"categories">, // バリデーション済みの categoryId
        memo: validation.data.memo,
      });
      // 保存成功 → 店名・金額・メモをクリア、日付・カテゴリを引き継ぐ
      setFormValues((prev) => ({ ...prev, shopName: "", amountYen: "", memo: "" }));
      setErrors({});
      setAiFieldStatuses(null);
      setStatus("idle");
      setSnackbar({ open: true, severity: "success", message: "レシートを保存しました" });
      // 店名欄にフォーカスを戻す
      shopNameRef.current?.focus();
    } catch (err) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "保存に失敗しました。もう一度お試しください。";
      setApiError(message);
      setSnackbar({ open: true, severity: "error", message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  const handleRetry = async () => {
    await submitForm();
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return {
    shopNameRef,
    formValues,
    errors,
    aiFieldStatuses,
    status,
    apiError,
    snackbar,
    selectedCategoryId,
    handleFieldChange,
    handleExtracted,
    handleSubmit,
    handleRetry,
    handleSnackbarClose,
  };
}

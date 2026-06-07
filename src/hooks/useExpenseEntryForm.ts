import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  validateExpenseItems,
  type ExpenseItemEntryErrors,
  type ExpenseItemEntryInput,
} from "../validation/expenseItems";

export type ExpenseItemState = {
  categoryId: Id<"categories"> | "";
  amountYen: string;
  title: string;
  memo: string;
};

type UseExpenseEntryFormArgs = {
  weekStartDate: string;
  weekEndDate: string;
  categories: Array<{ _id: Id<"categories">; name: string; color: string }>;
};

export function useExpenseEntryForm({ weekStartDate, categories }: UseExpenseEntryFormArgs) {
  const [shopName, setShopName] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [date, setDate] = useState(weekStartDate);
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [items, setItems] = useState<ExpenseItemState[]>([
    { categoryId: categories[0]?._id ?? "", amountYen: "", title: "", memo: "" },
  ]);
  const [shopNameError, setShopNameError] = useState("");
  const [sourceAmountError, setSourceAmountError] = useState("");
  const [itemErrors, setItemErrors] = useState<ExpenseItemEntryErrors[]>([{}]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [apiError, setApiError] = useState("");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingDifference, setPendingDifference] = useState(0);

  const createExpenseEntries = useMutation(api.expenseEntries.createExpenseEntries);

  // 単一モードの差額計算 (入力した合計金額 vs items[0].amountYen)
  const singleAmountNum = parseInt(items[0]?.amountYen || "0", 10) || 0;
  const sourceAmountNum = parseInt(sourceAmount || "0", 10) || 0;

  // 複数モードの差額
  const totalItemAmount = items.reduce((sum, item) => {
    const n = parseInt(item.amountYen || "0", 10) || 0;
    return sum + n;
  }, 0);
  const difference = isMultiMode && sourceAmountNum > 0 ? sourceAmountNum - totalItemAmount : null;

  const handleEnterMultiMode = () => {
    if (!shopName.trim()) {
      setShopNameError("店舗名 / 支払先は必須です");
      return;
    }
    if (!sourceAmount || parseInt(sourceAmount, 10) <= 0) {
      setSourceAmountError("金額は必須です");
      return;
    }
    setIsMultiMode(true);
    // 既存の入力内容を最初の項目として引き継ぐ
    setItems([{ categoryId: categories[0]?._id ?? "", amountYen: "", title: shopName, memo: "" }]);
    setItemErrors([{}]);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { categoryId: categories[0]?._id ?? "", amountYen: "", title: "", memo: "" },
    ]);
    setItemErrors((prev) => [...prev, {}]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ExpenseItemState, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setItemErrors((prev) =>
      prev.map((err, i) => (i === index ? { ...err, [field]: undefined } : err)),
    );
  };

  const doSave = async () => {
    setStatus("submitting");
    setApiError("");

    const itemInputs: ExpenseItemEntryInput[] = isMultiMode
      ? items.map((item) => ({
          categoryId: item.categoryId as string,
          amountYen: item.amountYen,
          title: item.title,
          memo: item.memo || undefined,
        }))
      : [
          {
            categoryId: (items[0]?.categoryId as string) ?? "",
            amountYen: singleAmountNum > 0 ? String(singleAmountNum) : sourceAmount,
            title: shopName,
            memo: items[0]?.memo || undefined,
          },
        ];

    const validation = validateExpenseItems({
      sourceAmount: isMultiMode && sourceAmountNum > 0 ? sourceAmountNum : undefined,
      items: itemInputs,
    });

    if (!validation.success) {
      if (validation.reason === "item_errors") {
        setItemErrors(validation.itemErrors);
        setStatus("idle");
        return;
      }
      if (validation.reason === "no_items") {
        setApiError("支出項目を1件以上入力してください");
        setStatus("error");
        return;
      }
      // amount_exceeded: 保存禁止（UIで既にブロック済み）
      setStatus("idle");
      return;
    }

    try {
      await createExpenseEntries({
        date,
        items: validation.data.items.map((item) => ({
          categoryId: item.categoryId as Id<"categories">,
          amountYen: item.amountYen,
          title: item.title,
          memo: item.memo,
        })),
      });

      // 保存成功 → リセット
      setShopName("");
      setSourceAmount("");
      setItems([{ categoryId: categories[0]?._id ?? "", amountYen: "", title: "", memo: "" }]);
      setItemErrors([{}]);
      setIsMultiMode(false);
      setStatus("idle");
      setSnackbar({ open: true, severity: "success", message: "支出項目を保存しました" });
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

    // 単一モードのバリデーション
    if (!isMultiMode) {
      let hasError = false;
      if (!shopName.trim()) {
        setShopNameError("店舗名 / 支払先は必須です");
        hasError = true;
      }
      if (!sourceAmount || parseInt(sourceAmount, 10) <= 0) {
        setSourceAmountError("金額は必須です");
        hasError = true;
      }
      if (hasError) return;
    }

    // 複数モード: 差額プラスなら確認ダイアログ
    if (isMultiMode && difference !== null && difference > 0) {
      setPendingDifference(difference);
      setShowConfirmDialog(true);
      return;
    }

    await doSave();
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    await doSave();
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setStatus("idle");
  };

  return {
    shopName,
    sourceAmount,
    date,
    isMultiMode,
    items,
    shopNameError,
    sourceAmountError,
    itemErrors,
    difference,
    status,
    apiError,
    snackbar,
    showConfirmDialog,
    pendingDifference,
    setShopName: (v: string) => {
      setShopName(v);
      if (v.trim()) setShopNameError("");
    },
    setSourceAmount: (v: string) => {
      setSourceAmount(v);
      if (v && parseInt(v, 10) > 0) setSourceAmountError("");
    },
    setDate,
    handleEnterMultiMode,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleSubmit,
    handleConfirmSave,
    handleCancelConfirm,
    handleSnackbarClose: () => setSnackbar((prev) => ({ ...prev, open: false })),
  };
}

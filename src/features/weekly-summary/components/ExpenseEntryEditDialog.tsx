import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useMutation } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import type { ReceiptItem } from "../types/types";

type CategoryOption = {
  _id: string;
  name: string;
};

export function ExpenseEntryEditDialog({
  categories,
  open,
  receipt,
  onClose,
  onSaved,
}: {
  categories: CategoryOption[];
  open: boolean;
  receipt: ReceiptItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateExpenseEntry = useMutation(api.expenseEntries.mutations.updateExpenseEntry);
  const updateReceipt = useMutation(api.receipts.crud.updateReceipt);
  const [date, setDate] = useState("");
  const [amountYen, setAmountYen] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!receipt) {
      return;
    }
    setDate(receipt.date);
    setAmountYen(String(receipt.amountYen));
    setCategoryId(receipt.categoryId);
    setTitle(
      receipt.type === "income"
        ? (receipt.bankName ?? "")
        : (receipt.itemName ?? receipt.shopName ?? ""),
    );
    setMemo(receipt.memo ?? "");
    setError("");
  }, [receipt]);

  const handleSave = async () => {
    if (!receipt) {
      return;
    }
    const parsedAmount = Number(amountYen.replace(/[^\d]/g, ""));
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("金額は1円以上の整数で入力してください。");
      return;
    }
    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!date.trim()) {
      setError("日付を入力してください。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (receipt.recordType === "expenseEntry") {
        if (receipt.type === "income") {
          await updateExpenseEntry({
            expenseEntryId: receipt._id as Id<"expenseEntries">,
            date,
            amountYen: parsedAmount,
            title: title.trim(),
            memo: memo.trim() || undefined,
          });
        } else {
          await updateExpenseEntry({
            expenseEntryId: receipt._id as Id<"expenseEntries">,
            date,
            amountYen: parsedAmount,
            categoryId: categoryId as Id<"categories">,
            title: title.trim(),
            memo: memo.trim() || undefined,
          });
        }
      } else if (receipt.type === "income") {
        await updateReceipt({
          receiptId: receipt._id as Id<"receipts">,
          date,
          amountYen: parsedAmount,
          bankName: title.trim(),
          memo: memo.trim() || undefined,
        });
      } else {
        await updateReceipt({
          receiptId: receipt._id as Id<"receipts">,
          date,
          amountYen: parsedAmount,
          categoryId: categoryId as Id<"categories">,
          shopName: title.trim(),
          memo: memo.trim() || undefined,
        });
      }
      onSaved();
      onClose();
    } catch {
      setError("保存に失敗しました。入力内容を確認して再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const entryLabel = receipt?.type === "income" ? "収入" : "支出";
  const isIncome = receipt?.type === "income";

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>{entryLabel}を編集</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="日付"
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            type="date"
            value={date}
          />
          <TextField
            fullWidth
            label="金額"
            onChange={(event) => setAmountYen(event.target.value.replace(/[^\d]/g, ""))}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            value={amountYen}
          />
          {!isIncome && (
            <TextField
              fullWidth
              label="カテゴリ"
              onChange={(event) => setCategoryId(event.target.value)}
              select
              value={categoryId}
            >
              {categories.map((category) => (
                <MenuItem key={category._id} value={category._id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            fullWidth
            label={receipt?.type === "income" ? "内容" : "タイトル"}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
          <TextField
            fullWidth
            label="メモ"
            minRows={2}
            multiline
            onChange={(event) => setMemo(event.target.value)}
            value={memo}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose} type="button">
          キャンセル
        </Button>
        <Button
          disabled={saving}
          onClick={() => void handleSave()}
          type="button"
          variant="contained"
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

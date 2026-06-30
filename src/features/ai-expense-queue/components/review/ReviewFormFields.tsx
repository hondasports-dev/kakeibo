import { MenuItem, TextField } from "@mui/material";
import { documentTypeLabels, reviewDocumentTypeOptions } from "../labels";
import type {
  AiExpenseQueueCategory,
  AiExpenseQueueDocumentType,
  ReviewFormValues,
} from "../../types/types";

export function ReviewFormFields({
  categories,
  reviewForm,
  onFieldChange,
}: {
  categories: AiExpenseQueueCategory[];
  reviewForm: ReviewFormValues;
  onFieldChange: (field: keyof ReviewFormValues, value: string) => void;
}) {
  return (
    <>
      <TextField
        fullWidth
        label="書類種別"
        onChange={(event) =>
          onFieldChange("documentType", event.target.value as AiExpenseQueueDocumentType)
        }
        select
        slotProps={{
          select: {
            displayEmpty: true,
            renderValue: (value) =>
              value === ""
                ? "書類種別を選択"
                : documentTypeLabels[value as AiExpenseQueueDocumentType],
          },
        }}
        value={reviewForm.documentType === "unknown" ? "" : reviewForm.documentType}
      >
        <MenuItem disabled value="">
          書類種別を選択
        </MenuItem>
        {reviewDocumentTypeOptions.map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        label="日付"
        onChange={(event) => onFieldChange("date", event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        type="date"
        value={reviewForm.date}
      />

      <TextField
        fullWidth
        label="合計金額"
        onChange={(event) => onFieldChange("amountYen", event.target.value.replace(/[^\d]/g, ""))}
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
          },
        }}
        value={reviewForm.amountYen}
      />

      <TextField
        fullWidth
        label="店名・内容"
        onChange={(event) => onFieldChange("shopName", event.target.value)}
        value={reviewForm.shopName}
      />

      <TextField
        fullWidth
        label="レシート全体のカテゴリ"
        onChange={(event) => onFieldChange("categoryId", event.target.value)}
        select
        value={reviewForm.categoryId}
      >
        {categories.map((category) => (
          <MenuItem key={category._id} value={category._id}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
    </>
  );
}

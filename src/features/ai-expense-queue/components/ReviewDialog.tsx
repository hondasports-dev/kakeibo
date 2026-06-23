import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { documentTypeLabels, getReviewReasonLabel, reviewDocumentTypeOptions } from "./labels";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  AiExpenseQueueDocumentType,
  ReviewFormValues,
} from "../types/types";

export function ReviewDialog({
  open,
  categories,
  isReviewDraftLoading,
  isReviewDraftNotFound,
  selectedReviewDraft,
  reviewError,
  reviewForm,
  reviewSubmitting,
  onClose,
  onFieldChange,
  onSubmit,
}: {
  open: boolean;
  categories: AiExpenseQueueCategory[];
  isReviewDraftLoading: boolean;
  isReviewDraftNotFound: boolean;
  selectedReviewDraft: AiExpenseDraft | null;
  reviewError: string;
  reviewForm: ReviewFormValues;
  reviewSubmitting: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof ReviewFormValues, value: string) => void;
  onSubmit: (registerAfterUpdate: boolean) => void;
}) {
  const isSubmitDisabled =
    reviewSubmitting || isReviewDraftLoading || isReviewDraftNotFound || categories.length === 0;

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>下書き確認</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isReviewDraftLoading && (
            <Typography color="text.secondary">下書きを読み込んでいます。</Typography>
          )}

          {isReviewDraftNotFound && (
            <Alert severity="error" variant="outlined">
              下書きが見つかりません。一覧を更新してもう一度確認してください。
            </Alert>
          )}

          {!isReviewDraftLoading && !isReviewDraftNotFound && (
            <>
              {selectedReviewDraft?.reviewReasons &&
                selectedReviewDraft.reviewReasons.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                    {selectedReviewDraft.reviewReasons.map((reason) => (
                      <Chip
                        key={reason}
                        label={getReviewReasonLabel(reason)}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                )}

              {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
                <Alert severity="warning" variant="outlined">
                  {selectedReviewDraft.warnings.join(" / ")}
                </Alert>
              )}

              {reviewError && (
                <Alert severity="error" variant="outlined">
                  {reviewError}
                </Alert>
              )}

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
                onChange={(event) =>
                  onFieldChange("amountYen", event.target.value.replace(/[^\d]/g, ""))
                }
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
                label="カテゴリ"
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
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button disabled={reviewSubmitting} onClick={onClose} type="button">
          キャンセル
        </Button>
        <Button
          disabled={isSubmitDisabled}
          onClick={() => onSubmit(false)}
          type="button"
          variant="outlined"
        >
          登録準備OKに戻す
        </Button>
        <Button
          disabled={isSubmitDisabled}
          onClick={() => onSubmit(true)}
          type="button"
          variant="contained"
        >
          修正して登録
        </Button>
      </DialogActions>
    </Dialog>
  );
}

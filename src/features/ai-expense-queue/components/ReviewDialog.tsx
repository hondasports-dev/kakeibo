import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { documentTypeLabels, getReviewReasonLabel, reviewDocumentTypeOptions } from "./labels";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  AiExpenseQueueDocumentType,
  ReviewFormValues,
  ReviewItemValues,
} from "../types/types";

export function ReviewDialog({
  open,
  categories,
  isReviewDraftLoading,
  isReviewDraftNotFound,
  selectedReviewDraft,
  reviewError,
  reviewForm,
  reviewItems,
  reviewSubmitting,
  onClose,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: {
  open: boolean;
  categories: AiExpenseQueueCategory[];
  isReviewDraftLoading: boolean;
  isReviewDraftNotFound: boolean;
  selectedReviewDraft: AiExpenseDraft | null;
  reviewError: string;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  reviewSubmitting: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof ReviewFormValues, value: string) => void;
  onItemChange: (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onSubmit: (registerAfterUpdate: boolean) => void;
}) {
  const isSubmitDisabled =
    reviewSubmitting || isReviewDraftLoading || isReviewDraftNotFound || categories.length === 0;
  const receiptAmount = Number(reviewForm.amountYen) || 0;
  const itemTotal = reviewItems.reduce((sum, item) => sum + (Number(item.amountYen) || 0), 0);
  const difference = receiptAmount - itemTotal;

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

              <Divider />

              <Stack spacing={1}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                  }}
                >
                  <Box>
                    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                      明細
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      明細合計 {itemTotal.toLocaleString("ja-JP")}円 / 差額{" "}
                      {difference.toLocaleString("ja-JP")}円
                    </Typography>
                  </Box>
                  <Button
                    onClick={onAddItem}
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    type="button"
                    variant="outlined"
                  >
                    明細を追加
                  </Button>
                </Stack>

                {difference !== 0 && reviewItems.length > 0 && (
                  <Alert severity="warning" variant="outlined">
                    レシート合計と明細合計に差額があります。
                  </Alert>
                )}

                {reviewItems.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    明細はありません。既存の単一カテゴリ下書きとして確認できます。
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {reviewItems.map((item, index) => {
                      const isLowConfidence =
                        (item.confidence?.itemName ?? 1) < 0.8 ||
                        (item.confidence?.amountYen ?? 1) < 0.8 ||
                        (item.confidence?.categoryId ?? item.confidence?.categoryName ?? 1) < 0.8;
                      const isUncategorized = !item.categoryId;
                      return (
                        <Box
                          key={item.id}
                          sx={{
                            border: "1px solid",
                            borderColor:
                              isUncategorized || isLowConfidence ? "warning.main" : "divider",
                            borderRadius: 1,
                            p: 1.5,
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: "space-between", alignItems: "center" }}
                            >
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                                <Chip label={`明細 ${index + 1}`} size="small" />
                                {isUncategorized && (
                                  <Chip
                                    color="warning"
                                    label="未分類"
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {isLowConfidence && (
                                  <Chip
                                    color="warning"
                                    label="低信頼度"
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              </Stack>
                              <IconButton
                                aria-label={`${item.itemName || `明細 ${index + 1}`}を削除`}
                                onClick={() => onRemoveItem(item.id)}
                                size="small"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>

                            {item.warnings && item.warnings.length > 0 && (
                              <Alert severity="warning" variant="outlined">
                                {item.warnings.join(" / ")}
                              </Alert>
                            )}

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <TextField
                                fullWidth
                                label="明細名"
                                onChange={(event) =>
                                  onItemChange(item.id, "itemName", event.target.value)
                                }
                                value={item.itemName}
                              />
                              <TextField
                                label="金額"
                                onChange={(event) =>
                                  onItemChange(
                                    item.id,
                                    "amountYen",
                                    event.target.value.replace(/[^\d]/g, ""),
                                  )
                                }
                                slotProps={{
                                  htmlInput: {
                                    inputMode: "numeric",
                                  },
                                }}
                                sx={{ minWidth: { sm: 140 } }}
                                value={item.amountYen}
                              />
                            </Stack>
                            <TextField
                              fullWidth
                              label="明細カテゴリ"
                              onChange={(event) =>
                                onItemChange(item.id, "categoryId", event.target.value)
                              }
                              select
                              value={item.categoryId}
                            >
                              <MenuItem value="">カテゴリ未分類</MenuItem>
                              {categories.map((category) => (
                                <MenuItem key={category._id} value={category._id}>
                                  {category.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
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

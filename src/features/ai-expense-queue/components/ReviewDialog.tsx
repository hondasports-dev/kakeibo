import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
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
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { documentTypeLabels, getReviewReasonLabel, reviewDocumentTypeOptions } from "./labels";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  AiExpenseQueueDocumentType,
  ReviewFormValues,
  ReviewItemValues,
} from "../types/types";
import {
  computeCategoryAggregates,
  computeItemTotalYen,
  formatReviewDraftHeader,
  getReviewAttentionLabels,
  hasLowConfidenceItems,
  hasUncategorizedItems,
  isLowConfidenceItem,
  resolveReviewShopName,
} from "../utils/reviewDialogUtils";

function ReviewFormFields({
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
  );
}

function ReviewItemsEditor({
  categories,
  reviewItems,
  receiptAmount,
  onAddItem,
  onItemChange,
  onRemoveItem,
}: {
  categories: AiExpenseQueueCategory[];
  reviewItems: ReviewItemValues[];
  receiptAmount: number;
  onAddItem: () => void;
  onItemChange: (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const itemTotal = computeItemTotalYen(reviewItems);
  const difference = receiptAmount - itemTotal;

  return (
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
            const uncategorized = !item.categoryId;
            const lowConfidence = isLowConfidenceItem(item);
            return (
              <Box
                key={item.id}
                sx={{
                  border: "1px solid",
                  borderColor: uncategorized || lowConfidence ? "warning.main" : "divider",
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
                      {uncategorized && (
                        <Chip color="warning" label="未分類" size="small" variant="outlined" />
                      )}
                      {lowConfidence && (
                        <Chip color="warning" label="低信頼度" size="small" variant="outlined" />
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
                      onChange={(event) => onItemChange(item.id, "itemName", event.target.value)}
                      value={item.itemName}
                    />
                    <TextField
                      label="金額"
                      onChange={(event) =>
                        onItemChange(item.id, "amountYen", event.target.value.replace(/[^\d]/g, ""))
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
                    onChange={(event) => onItemChange(item.id, "categoryId", event.target.value)}
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
  );
}

function ReviewItemsReadOnly({
  categories,
  reviewItems,
}: {
  categories: AiExpenseQueueCategory[];
  reviewItems: ReviewItemValues[];
}) {
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {reviewItems.map((item) => {
        const categoryName =
          categories.find((category) => category._id === item.categoryId)?.name ?? "未分類";
        const amountYen = Number(item.amountYen) || 0;
        return (
          <Box
            component="li"
            key={item.id}
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr auto", sm: "minmax(0, 1fr) auto auto" },
              alignItems: "center",
            }}
          >
            <Typography variant="body2">{item.itemName || "（名称なし）"}</Typography>
            <Typography sx={{ textAlign: "right", whiteSpace: "nowrap" }} variant="body2">
              {amountYen.toLocaleString("ja-JP")}円
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: "nowrap" }} variant="body2">
              {categoryName}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const hasLineItems = reviewItems.length > 0;
  const showSummaryView = hasLineItems && !isEditMode;
  const receiptAmount = Number(reviewForm.amountYen) || 0;
  const categoryAggregates = computeCategoryAggregates(reviewItems, categories);
  const attentionLabels = getReviewAttentionLabels({
    receiptAmountYen: receiptAmount,
    reviewItems,
  });
  const shopName = resolveReviewShopName(
    reviewForm,
    selectedReviewDraft?.shopName ?? selectedReviewDraft?.payeeName,
  );
  const isSubmitDisabled =
    reviewSubmitting || isReviewDraftLoading || isReviewDraftNotFound || categories.length === 0;

  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
      setItemsExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    setIsEditMode(false);
    setItemsExpanded(false);
  }, [selectedReviewDraft?._id]);

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
              {reviewError && (
                <Alert severity="error" variant="outlined">
                  {reviewError}
                </Alert>
              )}

              {showSummaryView ? (
                <>
                  <Box>
                    <Typography component="h2" sx={{ fontWeight: 700 }} variant="h6">
                      {shopName}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {formatReviewDraftHeader(reviewForm)}
                    </Typography>
                  </Box>

                  {(attentionLabels.length > 0 ||
                    (selectedReviewDraft?.reviewReasons?.length ?? 0) > 0) && (
                    <Stack spacing={1}>
                      <Typography color="warning.main" sx={{ fontWeight: 700 }} variant="body2">
                        確認が必要
                      </Typography>
                      {attentionLabels.map((label) => (
                        <Typography key={label} variant="body2">
                          {label}
                        </Typography>
                      ))}
                      {selectedReviewDraft?.reviewReasons?.map((reason) => (
                        <Typography color="text.secondary" key={reason} variant="body2">
                          {getReviewReasonLabel(reason)}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
                    <Alert severity="warning" variant="outlined">
                      {selectedReviewDraft.warnings.join(" / ")}
                    </Alert>
                  )}

                  <Stack spacing={1}>
                    <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle1">
                      登録候補
                    </Typography>
                    {categoryAggregates.length > 0 ? (
                      <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {categoryAggregates.map((aggregate) => (
                          <Typography component="li" key={aggregate.categoryId} variant="body2">
                            {aggregate.categoryName} {aggregate.amountYen.toLocaleString("ja-JP")}円
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography color="text.secondary" variant="body2">
                        カテゴリ別の登録候補はまだありません。
                      </Typography>
                    )}
                    {(hasUncategorizedItems(reviewItems) || hasLowConfidenceItems(reviewItems)) && (
                      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                        {hasUncategorizedItems(reviewItems) && (
                          <Chip
                            color="warning"
                            label="未分類あり"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {hasLowConfidenceItems(reviewItems) && (
                          <Chip
                            color="warning"
                            label="低信頼度あり"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    )}
                  </Stack>

                  <Button
                    endIcon={itemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setItemsExpanded((current) => !current)}
                    type="button"
                    variant="text"
                  >
                    {itemsExpanded ? "明細を閉じる" : "明細を見る"}
                  </Button>
                  <Collapse in={itemsExpanded}>
                    <ReviewItemsReadOnly categories={categories} reviewItems={reviewItems} />
                  </Collapse>
                </>
              ) : (
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

                  <ReviewFormFields
                    categories={categories}
                    onFieldChange={onFieldChange}
                    reviewForm={reviewForm}
                  />

                  {hasLineItems && (
                    <>
                      <Divider />
                      <ReviewItemsEditor
                        categories={categories}
                        onAddItem={onAddItem}
                        onItemChange={onItemChange}
                        onRemoveItem={onRemoveItem}
                        receiptAmount={receiptAmount}
                        reviewItems={reviewItems}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button disabled={reviewSubmitting} onClick={onClose} type="button">
          キャンセル
        </Button>
        {showSummaryView ? (
          <>
            <Button
              disabled={isSubmitDisabled}
              onClick={() => setIsEditMode(true)}
              type="button"
              variant="outlined"
            >
              修正する
            </Button>
            <Button
              disabled={isSubmitDisabled}
              onClick={() => onSubmit(true)}
              type="button"
              variant="contained"
            >
              登録する
            </Button>
          </>
        ) : (
          <>
            {hasLineItems && (
              <Button
                disabled={reviewSubmitting}
                onClick={() => setIsEditMode(false)}
                type="button"
                variant="text"
              >
                一覧に戻る
              </Button>
            )}
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
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

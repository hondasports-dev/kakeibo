import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Chip, Collapse, Stack, Typography } from "@mui/material";
import { ReviewReasonChips } from "../ReviewReasonChips";
import { StatusChip } from "../StatusChip";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import {
  computeCategoryAggregates,
  formatReviewDraftHeader,
  getReviewAttentionLabels,
  hasLowConfidenceItems,
  hasUncategorizedItems,
  resolveReviewShopName,
} from "../../utils/reviewDialogUtils";
import { ReviewItemsReadOnly } from "./ReviewItemsReadOnly";

export function ReviewSummaryView({
  categories,
  selectedReviewDraft,
  reviewForm,
  reviewItems,
  receiptAmount,
  itemsExpanded,
  onToggleItemsExpanded,
}: {
  categories: AiExpenseQueueCategory[];
  selectedReviewDraft: AiExpenseDraft | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  receiptAmount: number;
  itemsExpanded: boolean;
  onToggleItemsExpanded: () => void;
}) {
  const categoryAggregates = computeCategoryAggregates(reviewItems, categories);
  const attentionLabels = getReviewAttentionLabels({
    receiptAmountYen: receiptAmount,
    reviewItems,
  });
  const shopName = resolveReviewShopName(
    reviewForm,
    selectedReviewDraft?.shopName ?? selectedReviewDraft?.payeeName,
  );

  return (
    <>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography component="h2" sx={{ fontWeight: 700 }} variant="h6">
            {shopName}
          </Typography>
          {selectedReviewDraft && <StatusChip status={selectedReviewDraft.status} />}
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {formatReviewDraftHeader(reviewForm)}
        </Typography>
      </Box>

      {(attentionLabels.length > 0 || (selectedReviewDraft?.reviewReasons?.length ?? 0) > 0) && (
        <Stack spacing={1}>
          {attentionLabels.map((label) => (
            <Typography key={label} variant="body2">
              {label}
            </Typography>
          ))}
          {selectedReviewDraft?.reviewReasons && (
            <ReviewReasonChips
              reasons={selectedReviewDraft.reviewReasons}
              status={selectedReviewDraft.status}
            />
          )}
        </Stack>
      )}

      {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
        <Alert severity="warning" variant="outlined">
          {selectedReviewDraft.warnings.join(" / ")}
        </Alert>
      )}

      {selectedReviewDraft?.reviewReasons?.includes("multiple_categories") && (
        <Alert severity="info" variant="outlined">
          複数カテゴリに分類されています。登録候補と明細が正しいか確認してください。
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
              <Chip color="warning" label="未分類あり" size="small" variant="outlined" />
            )}
            {hasLowConfidenceItems(reviewItems) && (
              <Chip color="warning" label="低信頼度あり" size="small" variant="outlined" />
            )}
          </Stack>
        )}
      </Stack>

      <Button
        endIcon={itemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={onToggleItemsExpanded}
        type="button"
        variant="text"
      >
        {itemsExpanded ? "明細を閉じる" : "明細を見る"}
      </Button>
      <Collapse in={itemsExpanded}>
        <ReviewItemsReadOnly categories={categories} reviewItems={reviewItems} />
      </Collapse>
    </>
  );
}

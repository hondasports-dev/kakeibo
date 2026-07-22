import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { ReviewReasonChips } from "../ReviewReasonChips";
import { StatusChip } from "../StatusChip";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { formatReviewDraftHeader, resolveReviewShopName } from "../../utils/reviewDialogUtils";
import { getPrimaryReviewReason } from "../../utils/reviewFeedback";
import { ReceiptBulkTaxApply } from "./ReceiptBulkTaxApply";
import { ReceiptTaxSummary } from "./ReceiptTaxSummary";
import { ReceiptTotalsPanel } from "./ReceiptTotalsPanel";
import { ReviewItemsReadOnly } from "./ReviewItemsReadOnly";
import type { TaxSummaryChange } from "./ReceiptTaxSummaryEditor";

export function ReviewSummaryView({
  categories,
  selectedReviewDraft,
  reviewForm,
  reviewItems,
  itemsExpanded,
  onToggleItemsExpanded,
  onApplyReceiptTaxSettings,
  isApplyingReceiptTax,
  taxSummaryUpdatingIndex,
  onTaxSummaryChange,
}: {
  categories: AiExpenseQueueCategory[];
  selectedReviewDraft: AiExpenseDraft | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  itemsExpanded: boolean;
  onToggleItemsExpanded: () => void;
  onApplyReceiptTaxSettings?: () => void;
  isApplyingReceiptTax?: boolean;
  taxSummaryUpdatingIndex?: number | null;
  onTaxSummaryChange?: (index: number, change: TaxSummaryChange) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [taxDetailsExpanded, setTaxDetailsExpanded] = useState(false);

  useEffect(() => {
    setExpandedItemId(null);
    setTaxDetailsExpanded(false);
  }, [selectedReviewDraft?._id]);

  const shopName = resolveReviewShopName(
    reviewForm,
    selectedReviewDraft?.shopName ?? selectedReviewDraft?.payeeName,
  );
  const categoryName = categories.find((category) => category._id === reviewForm.categoryId)?.name;
  const reviewReasons = selectedReviewDraft?.reviewReasons ?? [];
  const primaryReviewReason = getPrimaryReviewReason(reviewReasons);

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
        <Typography color="text.secondary" variant="body2">
          カテゴリ：レシート全体（{categoryName ?? "未分類"}）
        </Typography>
        <Typography color="text.secondary" variant="body2">
          明細：{reviewItems.length}件
        </Typography>
      </Box>

      <ReceiptTotalsPanel
        bulkTaxAction={
          onApplyReceiptTaxSettings ? (
            <ReceiptBulkTaxApply
              isApplying={isApplyingReceiptTax}
              onApply={onApplyReceiptTaxSettings}
              reviewItems={reviewItems}
              taxSummaries={selectedReviewDraft?.taxSummaries}
            />
          ) : undefined
        }
        paidTotalYen={selectedReviewDraft?.amountYen}
        reviewItems={reviewItems}
        taxSummaries={selectedReviewDraft?.taxSummaries}
      />

      {primaryReviewReason && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <ReviewReasonChips
            reasons={[primaryReviewReason]}
            status={selectedReviewDraft?.status ?? "needs_review"}
          />
          {reviewReasons.length > 1 && (
            <Typography color="text.secondary" variant="body2">
              他{reviewReasons.length - 1}件
            </Typography>
          )}
        </Stack>
      )}

      {selectedReviewDraft?.taxSummaries && selectedReviewDraft.taxSummaries.length > 0 && (
        <>
          <Button
            onClick={() => setTaxDetailsExpanded((current) => !current)}
            size="small"
            type="button"
            variant="text"
            sx={{ alignSelf: "flex-start" }}
          >
            {taxDetailsExpanded ? "税情報を閉じる" : "税情報を確認"}
          </Button>
          <Collapse in={taxDetailsExpanded}>
            <ReceiptTaxSummary
              draft={selectedReviewDraft}
              onSummaryChange={onTaxSummaryChange}
              updatingIndex={taxSummaryUpdatingIndex}
            />
          </Collapse>
        </>
      )}

      <Button
        endIcon={itemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={onToggleItemsExpanded}
        type="button"
        variant="text"
      >
        {itemsExpanded ? "明細を閉じる" : "明細を見る"}
      </Button>
      <Collapse in={itemsExpanded}>
        <ReviewItemsReadOnly
          categories={categories}
          draft={selectedReviewDraft}
          expandedItemId={expandedItemId}
          onToggleItemDetail={(itemId) =>
            setExpandedItemId(expandedItemId === itemId ? null : itemId)
          }
          reviewItems={reviewItems}
        />
      </Collapse>
    </>
  );
}

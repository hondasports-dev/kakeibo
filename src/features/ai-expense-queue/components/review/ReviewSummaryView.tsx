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
import { ReceiptBulkTaxApply } from "./ReceiptBulkTaxApply";
import { ReceiptTaxSummary } from "./ReceiptTaxSummary";
import { ReceiptTotalsPanel } from "./ReceiptTotalsPanel";
import { ReviewItemsReadOnly } from "./ReviewItemsReadOnly";

export function ReviewSummaryView({
  categories,
  selectedReviewDraft,
  reviewForm,
  reviewItems,
  itemsExpanded,
  onToggleItemsExpanded,
  onApplyReceiptTaxSettings,
  isApplyingReceiptTax,
}: {
  categories: AiExpenseQueueCategory[];
  selectedReviewDraft: AiExpenseDraft | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  itemsExpanded: boolean;
  onToggleItemsExpanded: () => void;
  onApplyReceiptTaxSettings?: () => void;
  isApplyingReceiptTax?: boolean;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedItemId(null);
  }, [selectedReviewDraft?._id]);

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

      {selectedReviewDraft?.reviewReasons && selectedReviewDraft.reviewReasons.length > 0 && (
        <ReviewReasonChips
          reasons={selectedReviewDraft.reviewReasons}
          status={selectedReviewDraft.status}
        />
      )}

      <ReceiptTaxSummary draft={selectedReviewDraft} />

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

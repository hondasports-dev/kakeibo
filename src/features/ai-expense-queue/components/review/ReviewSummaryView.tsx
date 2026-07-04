import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { ReviewReasonChips } from "../ReviewReasonChips";
import { StatusChip } from "../StatusChip";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { formatReviewDraftHeader, resolveReviewShopName } from "../../utils/reviewDialogUtils";
import { toReceiptAnalysisViewModel } from "../../utils/receiptItemTaxViewModel";
import { formatTaxWarnings } from "../../utils/taxWarnings";
import { ReceiptAnalysisStatusAlert } from "./ReceiptAnalysisStatusAlert";
import { ReceiptItemRow } from "./ReceiptItemRow";
import { ReceiptItemTaxDetail } from "./ReceiptItemTaxDetail";
import { ReceiptTaxSummary } from "./ReceiptTaxSummary";

export function ReviewSummaryView({
  categories,
  selectedReviewDraft,
  reviewForm,
  reviewItems,
  itemsExpanded,
  onToggleItemsExpanded,
}: {
  categories: AiExpenseQueueCategory[];
  selectedReviewDraft: AiExpenseDraft | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  itemsExpanded: boolean;
  onToggleItemsExpanded: () => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const shopName = resolveReviewShopName(
    reviewForm,
    selectedReviewDraft?.shopName ?? selectedReviewDraft?.payeeName,
  );
  const analysis = toReceiptAnalysisViewModel({
    reviewItems,
    paidTotalYen: selectedReviewDraft?.amountYen,
    draftWarnings: selectedReviewDraft?.warnings,
  });

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

      <ReceiptAnalysisStatusAlert analysis={analysis} />

      {selectedReviewDraft?.reviewReasons && selectedReviewDraft.reviewReasons.length > 0 && (
        <ReviewReasonChips
          reasons={selectedReviewDraft.reviewReasons}
          status={selectedReviewDraft.status}
        />
      )}

      {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
        <Alert severity="warning" variant="outlined">
          {formatTaxWarnings(selectedReviewDraft.warnings)}
        </Alert>
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
        <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {reviewItems.map((item) => {
            const categoryName =
              categories.find((category) => category._id === item.categoryId)?.name ?? "未分類";
            const isDetailOpen = expandedItemId === item.id;
            return (
              <Box
                component="li"
                key={item.id}
                sx={{
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  pb: 1,
                }}
              >
                <ReceiptItemRow
                  item={item}
                  onOpenDetail={() => setExpandedItemId(isDetailOpen ? null : item.id)}
                />
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                  カテゴリ: {categoryName}
                </Typography>
                <Collapse in={isDetailOpen}>
                  <Box sx={{ mt: 1 }}>
                    <ReceiptItemTaxDetail draft={selectedReviewDraft} item={item} />
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </Collapse>
    </>
  );
}

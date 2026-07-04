import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { ReviewReasonChips } from "../ReviewReasonChips";
import { StatusChip } from "../StatusChip";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { formatReviewDraftHeader, resolveReviewShopName } from "../../utils/reviewDialogUtils";
import { ReviewItemsReadOnly } from "./ReviewItemsReadOnly";
import { formatTaxWarnings } from "../../utils/taxWarnings";

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

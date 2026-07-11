import { Button, Chip, Stack } from "@mui/material";
import type { AiExpenseQueueItem } from "../../types/types";
import { displayStatusLabels } from "../labels";

type QueueStatusHeaderProps = {
  groupedItems: {
    processing: AiExpenseQueueItem[];
    ready: AiExpenseQueueItem[];
    needs_review: AiExpenseQueueItem[];
    failed: AiExpenseQueueItem[];
    registered: AiExpenseQueueItem[];
  };
  itemCount: number;
  firstReviewItem?: AiExpenseQueueItem;
  onOpenReview: (itemId: string) => void;
};

export function QueueStatusHeader({
  groupedItems,
  itemCount,
  firstReviewItem,
  onOpenReview,
}: QueueStatusHeaderProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignItems: "stretch" }}>
      <Stack
        className="ai-expense-queue-status-summary"
        direction="row"
        spacing={1}
        sx={{ flex: 1, flexWrap: "wrap", minWidth: 0, width: "100%" }}
      >
        <Chip
          color="default"
          label={`${displayStatusLabels.processing} ${groupedItems.processing.length}件`}
          size="small"
          variant="outlined"
        />
        <Chip
          color="success"
          label={`${displayStatusLabels.ready} ${groupedItems.ready.length}件`}
          size="small"
        />
        <Chip
          color="warning"
          label={`${displayStatusLabels.needs_review} ${groupedItems.needs_review.length}件`}
          size="small"
        />
        <Chip
          color="error"
          label={`${displayStatusLabels.failed} ${groupedItems.failed.length}件`}
          size="small"
        />
        <Chip
          label={`${displayStatusLabels.registered} ${groupedItems.registered.length}件`}
          size="small"
          variant="outlined"
        />
        <Chip label={`追加済み ${itemCount}件`} size="small" variant="outlined" />
      </Stack>
      {firstReviewItem && (
        <Button
          aria-label={`下書きを確認（${groupedItems.needs_review.length}件）`}
          onClick={() => onOpenReview(firstReviewItem.id)}
          type="button"
          variant="outlined"
          sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
        >
          下書きを確認
        </Button>
      )}
    </Stack>
  );
}

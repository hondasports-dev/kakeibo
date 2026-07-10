import { Alert, Button, Divider, Stack } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import type { QueueContentProps } from "./queueContentTypes";
import { getQueueContentSummary } from "../../utils/queueContent";
import { QueueStatusHeader } from "./QueueStatusHeader";
import { QueueReadyRegisterPanel } from "./QueueReadyRegisterPanel";
import { QueueActiveSections } from "./QueueActiveSections";

export function QueueActiveContent({
  clearableCount,
  deletingIds,
  groupedItems,
  itemCount,
  readyItems,
  registeringIds,
  registrationError,
  selectedReadyIds,
  onClearOpenQueue,
  onDeleteQueueItem,
  onOpenReview,
  onRegisterReady,
  onRetry,
  onToggleReadySelection,
}: QueueContentProps) {
  const { firstReviewItem, prioritizedReviewItems } = getQueueContentSummary({
    groupedItems,
    readyItems,
    selectedReadyIds,
  });

  return (
    <Stack className="queue-content queue-content-active" spacing={2}>
      {registrationError && (
        <Alert severity="error" variant="outlined">
          {registrationError}
        </Alert>
      )}

      <QueueStatusHeader
        firstReviewItem={firstReviewItem}
        groupedItems={groupedItems}
        itemCount={itemCount}
        onOpenReview={onOpenReview}
      />

      {clearableCount > 0 && (
        <Button
          color="error"
          disabled={deletingIds.length > 0}
          onClick={() => void onClearOpenQueue()}
          startIcon={<DeleteIcon />}
          type="button"
          variant="outlined"
          sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
        >
          未登録の画像をクリア（{clearableCount}件）
        </Button>
      )}

      <QueueReadyRegisterPanel
        readyItems={readyItems}
        selectedReadyIds={selectedReadyIds}
        registeringIds={registeringIds}
        onRegisterReady={onRegisterReady}
      />

      <Divider />

      <QueueActiveSections
        deletingIds={deletingIds}
        groupedItems={groupedItems}
        onDeleteQueueItem={onDeleteQueueItem}
        onOpenReview={onOpenReview}
        onRegisterReady={onRegisterReady}
        onRetry={onRetry}
        onToggleReadySelection={onToggleReadySelection}
        prioritizedReviewItems={prioritizedReviewItems}
        registeringIds={registeringIds}
        selectedReadyIds={selectedReadyIds}
      />
    </Stack>
  );
}

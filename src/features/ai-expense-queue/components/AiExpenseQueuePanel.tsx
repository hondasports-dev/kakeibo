import { Alert, Box, Stack } from "@mui/material";
import { QueueContent } from "./QueueContent";
import { QueueEmptyState } from "./QueueEmptyState";
import { QueueHeader } from "./QueueHeader";
import { ReviewDialog } from "./ReviewDialog";
import { ReceiptImageConsentDialog } from "./ReceiptImageConsentDialog";
import { useAiExpenseQueuePanel } from "../hooks/useAiExpenseQueuePanel";
import type { AiExpenseQueuePanelProps } from "../types/types";

export type { AiExpenseQueueItem } from "../types/types";

export function AiExpenseQueuePanel({
  initialItems,
  categories = [],
  initialReviewDrafts = {},
  initialReviewDraftItems = {},
  onReviewSubmit,
}: AiExpenseQueuePanelProps) {
  const queue = useAiExpenseQueuePanel({
    initialItems,
    categories,
    initialReviewDrafts,
    initialReviewDraftItems,
    onReviewSubmit,
  });

  return (
    <Box
      aria-labelledby="ai-expense-queue-heading"
      className="ai-expense-queue"
      component="section"
    >
      <Stack spacing={2} sx={{ maxWidth: "100%", minWidth: 0 }}>
        <QueueHeader
          disabled={queue.consentIsLoading}
          inputRef={queue.inputRef}
          cameraInputRef={queue.cameraInputRef}
          retryInputRef={queue.retryInputRef}
          onFilesSelected={queue.handleFilesSelected}
          onRetryFileSelected={queue.handleRetryFileSelected}
        />

        {queue.retryError && (
          <Alert severity="error" variant="outlined" onClose={() => queue.setRetryError("")}>
            {queue.retryError}
          </Alert>
        )}

        {queue.queueDeleteError && (
          <Alert severity="error" variant="outlined" onClose={() => queue.setQueueDeleteError("")}>
            {queue.queueDeleteError}
          </Alert>
        )}

        {queue.items.length === 0 ? (
          <QueueEmptyState
            addReceiptDisabled={queue.consentIsLoading}
            onAddReceipt={() => queue.inputRef.current?.click()}
          />
        ) : (
          <QueueContent
            clearableCount={queue.clearableItems.length}
            deletingIds={queue.deletingIds}
            groupedItems={queue.groupedItems}
            itemCount={queue.items.length}
            readyItems={queue.readyItems}
            registeringIds={queue.registeringIds}
            registrationError={queue.registrationError}
            selectedReadyIds={queue.selectedReadyIds}
            onClearOpenQueue={queue.handleClearOpenQueue}
            onDeleteQueueItem={queue.deleteQueueItem}
            onOpenReview={queue.handleOpenReview}
            onRegisterReady={queue.handleRegisterReady}
            onRetry={queue.handleRetry}
            onToggleReadySelection={queue.handleToggleReadySelection}
          />
        )}
      </Stack>

      <ReviewDialog
        open={queue.selectedReviewDraftId !== null}
        categories={categories}
        isReviewDraftLoading={queue.isReviewDraftLoading}
        isReviewDraftNotFound={queue.isReviewDraftNotFound}
        selectedReviewDraft={queue.selectedReviewDraft}
        reviewError={queue.reviewError}
        reviewForm={queue.reviewForm}
        reviewItems={queue.reviewItems}
        isCategorySplit={queue.isCategorySplit}
        reviewSubmitting={queue.reviewSubmitting}
        onAddItem={queue.handleAddReviewItem}
        onClose={queue.handleCloseReview}
        onFieldChange={queue.handleReviewFieldChange}
        onItemChange={queue.handleReviewItemChange}
        onRemoveItem={queue.handleRemoveReviewItem}
        onCategorySplitChange={queue.handleCategorySplitChange}
        onAssignCategoryToItems={queue.handleAssignCategoryToItems}
        onDiscountTargetChange={queue.handleDiscountTargetChange}
        onSubmit={(registerAfterUpdate) => void queue.handleSubmitReview(registerAfterUpdate)}
      />

      <ReceiptImageConsentDialog
        open={queue.consentDialogOpen}
        saving={queue.consentStatus === "saving"}
        onAccept={() => void queue.handleAcceptConsent()}
        onDecline={queue.handleDeclineConsent}
      />
    </Box>
  );
}

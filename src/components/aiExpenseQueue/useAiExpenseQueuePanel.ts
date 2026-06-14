import type { AiExpenseQueueItem, AiExpenseQueuePanelProps } from "./types";
import { useAiExpenseQueueData } from "./useAiExpenseQueueData";
import { useBulkRegister } from "./useBulkRegister";
import { useImageUpload } from "./useImageUpload";
import { useQueueDelete } from "./useQueueDelete";
import { useRetry } from "./useRetry";
import { useReviewDialog } from "./useReviewDialog";

export function useAiExpenseQueuePanel({
  initialItems,
  categories,
  initialReviewDrafts,
  onReviewSubmit,
}: Required<Pick<AiExpenseQueuePanelProps, "categories" | "initialReviewDrafts">> &
  Pick<AiExpenseQueuePanelProps, "initialItems" | "onReviewSubmit">) {
  const imageUpload = useImageUpload();
  const queueDelete = useQueueDelete();
  const queueData = useAiExpenseQueueData({
    categories,
    hiddenItemIds: queueDelete.hiddenItemIds,
    initialItems,
  });
  const bulkRegister = useBulkRegister({
    readyItemIds: queueData.readyItemIds,
  });
  const reviewDialog = useReviewDialog({
    initialReviewDrafts,
    onReviewSubmit,
  });
  const retry = useRetry({
    pendingImageDataUrls: imageUpload.pendingImageDataUrls,
    setPendingImageDataUrls: imageUpload.setPendingImageDataUrls,
  });

  const wrappedDeleteQueueItem = async (item: AiExpenseQueueItem) => {
    await queueDelete.deleteQueueItem(item);
    bulkRegister.removeFromSelection(item.id);
  };

  const wrappedHandleClearOpenQueue = async () => {
    for (const item of queueData.clearableItems) {
      await wrappedDeleteQueueItem(item);
    }
  };

  const wrappedHandleRetry = async (draftId: string) => {
    await retry.handleRetry(draftId, queueData.jobs);
  };

  return {
    cameraInputRef: imageUpload.cameraInputRef,
    clearableItems: queueData.clearableItems,
    deletingIds: queueDelete.deletingIds,
    groupedItems: queueData.groupedItems,
    inputRef: imageUpload.inputRef,
    isReviewDraftLoading: reviewDialog.isReviewDraftLoading,
    isReviewDraftNotFound: reviewDialog.isReviewDraftNotFound,
    items: queueData.items,
    queueDeleteError: queueDelete.queueDeleteError,
    readyItems: queueData.readyItems,
    registeringIds: bulkRegister.registeringIds,
    registrationError: bulkRegister.registrationError,
    retryError: imageUpload.uploadError || retry.retryError,
    retryInputRef: retry.retryInputRef,
    reviewError: reviewDialog.reviewError,
    reviewForm: reviewDialog.reviewForm,
    reviewSubmitting: reviewDialog.reviewSubmitting,
    selectedReadyIds: bulkRegister.selectedReadyIds,
    selectedReviewDraft: reviewDialog.selectedReviewDraft,
    selectedReviewDraftId: reviewDialog.selectedReviewDraftId,
    setQueueDeleteError: queueDelete.setQueueDeleteError,
    setRetryError: (error: string) => {
      imageUpload.setUploadError("");
      retry.setRetryError(error);
    },
    handleClearOpenQueue: wrappedHandleClearOpenQueue,
    handleCloseReview: reviewDialog.handleCloseReview,
    handleFilesSelected: imageUpload.handleFilesSelected,
    handleOpenReview: reviewDialog.handleOpenReview,
    handleRegisterReady: bulkRegister.handleRegisterReady,
    handleRetry: wrappedHandleRetry,
    handleRetryFileSelected: retry.handleRetryFileSelected,
    handleReviewFieldChange: reviewDialog.handleReviewFieldChange,
    handleSubmitReview: reviewDialog.handleSubmitReview,
    handleToggleReadySelection: bulkRegister.handleToggleReadySelection,
    deleteQueueItem: wrappedDeleteQueueItem,
  };
}

import type {
  AiExpenseQueuePanelProps,
  AiExpenseDraft,
  AiExpenseDraftItem,
} from "../../types/types";
import { useReviewDraftSelection } from "./useReviewDraftSelection";
import { useReviewFormState } from "./useReviewFormState";
import { useReviewSubmit } from "./useReviewSubmit";
import { useReviewTaxOverrides } from "./useReviewTaxOverrides";

export function useReviewDialog({
  initialReviewDrafts,
  initialReviewDraftItems,
  onReviewSubmit,
  onRegister,
}: {
  initialReviewDrafts: Record<string, AiExpenseDraft>;
  initialReviewDraftItems: Record<string, AiExpenseDraftItem[]>;
  onReviewSubmit?: AiExpenseQueuePanelProps["onReviewSubmit"];
  onRegister?: (draftId: string) => void;
}) {
  const draftSelection = useReviewDraftSelection({
    initialReviewDrafts,
    initialReviewDraftItems,
  });

  const formState = useReviewFormState({
    selectedReviewDraftId: draftSelection.selectedReviewDraftId,
    selectedReviewDraft: draftSelection.selectedReviewDraft,
    localReviewItems: draftSelection.localReviewItems,
    selectedReviewDraftDetails: draftSelection.selectedReviewDraftDetails,
  });

  const submit = useReviewSubmit({
    selectedReviewDraftId: draftSelection.selectedReviewDraftId,
    reviewForm: formState.reviewForm,
    reviewItems: formState.reviewItems,
    onReviewSubmit,
    onRegister,
    clearSelection: draftSelection.clearSelection,
    resetForm: formState.resetForm,
  });

  const taxOverrides = useReviewTaxOverrides({
    selectedReviewDraftId: draftSelection.selectedReviewDraftId,
    setReviewItems: formState.setReviewItems,
    setReviewDraftOverride: draftSelection.setReviewDraftOverride,
    setReviewError: submit.setReviewError,
  });

  const handleOpenReview = (itemId: string) => {
    draftSelection.setReviewDraftOverride(null);
    draftSelection.setSelectedReviewDraftId(itemId);
    formState.prepareForDraft();
    submit.clearReviewError();
  };

  const handleCloseReview = () => {
    if (submit.reviewSubmitting) {
      return;
    }
    draftSelection.clearSelection();
    formState.resetForm();
    submit.clearReviewError();
  };

  return {
    selectedReviewDraftId: draftSelection.selectedReviewDraftId,
    initializedReviewDraftId: formState.initializedReviewDraftId,
    selectedReviewDraft: draftSelection.selectedReviewDraft,
    isReviewDraftLoading: draftSelection.isReviewDraftLoading,
    isReviewDraftNotFound: draftSelection.isReviewDraftNotFound,
    reviewForm: formState.reviewForm,
    reviewItems: formState.reviewItems,
    isCategorySplit: formState.isCategorySplit,
    reviewError: submit.reviewError,
    reviewSubmitting: submit.reviewSubmitting,
    setSelectedReviewDraftId: draftSelection.setSelectedReviewDraftId,
    setInitializedReviewDraftId: formState.setInitializedReviewDraftId,
    setReviewForm: formState.setReviewForm,
    setReviewItems: formState.setReviewItems,
    setReviewError: submit.setReviewError,
    setReviewSubmitting: submit.setReviewSubmitting,
    handleOpenReview,
    handleCloseReview,
    handleReviewFieldChange: formState.handleReviewFieldChange,
    handleReviewItemChange: formState.handleReviewItemChange,
    handleAddReviewItem: formState.handleAddReviewItem,
    handleRemoveReviewItem: formState.handleRemoveReviewItem,
    handleCategorySplitChange: formState.handleCategorySplitChange,
    handleAssignCategoryToItems: formState.handleAssignCategoryToItems,
    handleDiscountTargetChange: formState.handleDiscountTargetChange,
    handleSubmitReview: submit.handleSubmitReview,
    taxUpdatingItemId: taxOverrides.taxUpdatingItemId,
    handleTaxRateChange: taxOverrides.handleTaxRateChange,
    handleAmountBasisChange: taxOverrides.handleAmountBasisChange,
  };
}

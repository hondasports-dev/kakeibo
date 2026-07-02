import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { getReviewSubmitError } from "../../utils/reviewValidation";
import { toUserFacingReviewError } from "../../utils/userFacingErrors";
import type {
  AiExpenseQueuePanelProps,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { prepareReviewItemsForSubmit } from "../../utils/reviewItemCategories";

export function useReviewSubmit({
  selectedReviewDraftId,
  reviewForm,
  reviewItems,
  onReviewSubmit,
  onRegister,
  clearSelection,
  resetForm,
}: {
  selectedReviewDraftId: string | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  onReviewSubmit?: AiExpenseQueuePanelProps["onReviewSubmit"];
  onRegister?: (draftId: string) => void;
  clearSelection: () => void;
  resetForm: () => void;
}) {
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const updateForReview = useMutation(api.aiExpenseDrafts.mutations.updateForReview);
  const registerReadyDraftsAsExpenseEntries = useMutation(
    api.aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries,
  );

  const handleSubmitReview = async (registerAfterUpdate: boolean) => {
    if (!selectedReviewDraftId) {
      return;
    }
    const validationError = getReviewSubmitError(reviewForm, reviewItems);
    if (validationError) {
      setReviewError(validationError);
      return;
    }
    const amountYen = Number(reviewForm.amountYen);
    const submittedItems = prepareReviewItemsForSubmit(reviewItems, reviewForm.categoryId);

    setReviewSubmitting(true);
    setReviewError("");
    try {
      if (onReviewSubmit) {
        await onReviewSubmit(
          selectedReviewDraftId,
          {
            documentType: reviewForm.documentType,
            shopName: reviewForm.shopName,
            date: reviewForm.date,
            amountYen,
            categoryId: reviewForm.categoryId,
            items: submittedItems.map((item) => ({
              itemName: item.itemName.trim(),
              amountYen: Number(item.amountYen),
              categoryId: item.categoryId,
            })),
          },
          registerAfterUpdate,
        );
      } else {
        await updateForReview({
          draftId: selectedReviewDraftId as Id<"aiExpenseDrafts">,
          documentType: reviewForm.documentType,
          shopName: reviewForm.shopName,
          date: reviewForm.date,
          amountYen,
          categoryId: reviewForm.categoryId as Id<"categories">,
          items: submittedItems.map((item) => ({
            itemName: item.itemName.trim(),
            amountYen: Number(item.amountYen),
            categoryId: item.categoryId as Id<"categories">,
            confidence: {
              ...item.confidence,
              itemName: 1,
              amountYen: 1,
              categoryId: 1,
            },
            warnings: item.warnings ?? [],
          })),
        });

        if (registerAfterUpdate) {
          onRegister?.(selectedReviewDraftId);
          await registerReadyDraftsAsExpenseEntries({
            draftIds: [selectedReviewDraftId as Id<"aiExpenseDrafts">],
          });
        }
      }

      clearSelection();
      resetForm();
    } catch (error) {
      setReviewError(toUserFacingReviewError(error));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const clearReviewError = () => {
    setReviewError("");
  };

  return {
    reviewError,
    reviewSubmitting,
    setReviewError,
    setReviewSubmitting,
    handleSubmitReview,
    clearReviewError,
  };
}

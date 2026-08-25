import { useState } from "react";
import { useMutation } from "convex/react";
import {
  registerReadyDraftsAsExpenseEntriesApi,
  resetReceiptToAiInterpretationApi,
  updateForReviewApi,
} from "../../../../lib/repositories/aiExpenseDrafts";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getReviewSubmitError } from "../../utils/reviewValidation";
import { toUserFacingReviewError } from "../../utils/userFacingErrors";
import type {
  AiExpenseQueuePanelProps,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { prepareReviewItemsForSubmit } from "../../utils/reviewItemCategories";
import { formatReviewSaveMessage } from "../../utils/reviewFeedback";

export function useReviewSubmit({
  selectedReviewDraftId,
  reviewForm,
  reviewItems,
  categoryName,
  onReviewSubmit,
  onRegister,
  clearSelection,
  resetForm,
}: {
  selectedReviewDraftId: string | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  categoryName?: string;
  onReviewSubmit?: AiExpenseQueuePanelProps["onReviewSubmit"];
  onRegister?: (draftId: string) => void;
  clearSelection: () => void;
  resetForm: () => void;
}) {
  const [reviewError, setReviewError] = useState("");
  const [reviewSaveFeedback, setReviewSaveFeedback] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const updateForReview = useMutation(updateForReviewApi());
  const resetReceiptToAiInterpretation = useMutation(resetReceiptToAiInterpretationApi());
  const registerReadyDraftsAsExpenseEntries = useMutation(registerReadyDraftsAsExpenseEntriesApi());

  const handleResetToAiInterpretation = async () => {
    if (!selectedReviewDraftId) {
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    try {
      await resetReceiptToAiInterpretation({
        draftId: selectedReviewDraftId as Id<"aiExpenseDrafts">,
      });
      setReviewSaveFeedback({
        message: "ユーザー補正を解除し、AI判定へ戻しました。",
        severity: "success",
      });
      clearSelection();
      resetForm();
    } catch (error) {
      const message = toUserFacingReviewError(error);
      setReviewError(message);
      setReviewSaveFeedback({ message, severity: "error" });
    } finally {
      setReviewSubmitting(false);
    }
  };

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
        const updated = await onReviewSubmit(
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
        setReviewSaveFeedback({
          message: formatReviewSaveMessage({
            amountYen,
            categoryName,
            reviewReasons: updated.reviewReasons,
            shopName: reviewForm.shopName,
            status: updated.status === "needs_review" ? "needs_review" : "ready",
          }),
          severity: "success",
        });
        clearSelection();
        resetForm();
      } else {
        const updated = await updateForReview({
          draftId: selectedReviewDraftId as Id<"aiExpenseDrafts">,
          documentType: reviewForm.documentType,
          shopName: reviewForm.shopName,
          date: reviewForm.date,
          amountYen,
          categoryId: reviewForm.categoryId as Id<"categories">,
          items: submittedItems.map((item) => ({
            ...(item.persistedItemId
              ? { itemId: item.persistedItemId as Id<"aiExpenseDraftItems"> }
              : {}),
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

        setReviewSaveFeedback({
          message: formatReviewSaveMessage({
            amountYen,
            categoryName,
            reviewReasons: updated.reviewReasons ?? [],
            shopName: reviewForm.shopName,
            status: updated.status === "needs_review" ? "needs_review" : "ready",
          }),
          severity: "success",
        });

        clearSelection();
        resetForm();
      }
    } catch (error) {
      const message = toUserFacingReviewError(error);
      setReviewError(message);
      setReviewSaveFeedback({ message, severity: "error" });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const clearReviewError = () => {
    setReviewError("");
  };

  const clearReviewSaveFeedback = () => {
    setReviewSaveFeedback(null);
  };

  return {
    reviewError,
    reviewSaveFeedback,
    reviewSubmitting,
    setReviewError,
    setReviewSubmitting,
    handleSubmitReview,
    handleResetToAiInterpretation,
    clearReviewError,
    clearReviewSaveFeedback,
  };
}

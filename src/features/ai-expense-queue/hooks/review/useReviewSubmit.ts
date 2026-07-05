import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import {
  mapConvexDraftToAiExpenseDraft,
  mapDraftItemsToReviewItems,
  isDraftWithItems,
} from "../../utils/mappers";
import { getReviewSubmitError } from "../../utils/reviewValidation";
import { toUserFacingReviewError } from "../../utils/userFacingErrors";
import type {
  AiExpenseDraft,
  AiExpenseQueuePanelProps,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { prepareReviewItemsForSubmit } from "../../utils/reviewItemCategories";

export const REVIEW_SAVED_NEEDS_REVIEW_NOTICE =
  "保存しました。税率の確定または金額の調整が必要です。下の一括適用を試すか、明細を確認してください。";

export function useReviewSubmit({
  selectedReviewDraftId,
  reviewForm,
  reviewItems,
  onReviewSubmit,
  onRegister,
  clearSelection,
  resetForm,
  setReviewDraftOverride,
  setReviewItems,
  setInitializedReviewDraftId,
}: {
  selectedReviewDraftId: string | null;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  onReviewSubmit?: AiExpenseQueuePanelProps["onReviewSubmit"];
  onRegister?: (draftId: string) => void;
  clearSelection: () => void;
  resetForm: () => void;
  setReviewDraftOverride?: (draft: AiExpenseDraft) => void;
  setReviewItems?: (items: ReviewItemValues[]) => void;
  setInitializedReviewDraftId?: (draftId: string | null) => void;
}) {
  const convex = useConvex();
  const [reviewError, setReviewError] = useState("");
  const [reviewSaveNotice, setReviewSaveNotice] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const updateForReview = useMutation(api.aiExpenseDrafts.mutations.updateForReview);
  const registerReadyDraftsAsExpenseEntries = useMutation(
    api.aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries,
  );

  const refreshSavedDraft = async (draftId: string) => {
    if (!setReviewDraftOverride || !setReviewItems || !setInitializedReviewDraftId) {
      return;
    }
    const details = await convex.query(api.aiExpenseDrafts.queries.getWithItems, {
      draftId: draftId as Id<"aiExpenseDrafts">,
    });
    if (!isDraftWithItems(details)) {
      return;
    }
    setReviewDraftOverride(mapConvexDraftToAiExpenseDraft(details.draft));
    setReviewItems(mapDraftItemsToReviewItems(details.items));
    setInitializedReviewDraftId(null);
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
    setReviewSaveNotice("");
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

        if (updated.status === "needs_review") {
          setReviewSaveNotice(REVIEW_SAVED_NEEDS_REVIEW_NOTICE);
          await refreshSavedDraft(selectedReviewDraftId);
          return;
        }

        clearSelection();
        resetForm();
      }
    } catch (error) {
      setReviewError(toUserFacingReviewError(error));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const clearReviewError = () => {
    setReviewError("");
  };

  const clearReviewSaveNotice = () => {
    setReviewSaveNotice("");
  };

  return {
    reviewError,
    reviewSaveNotice,
    reviewSubmitting,
    setReviewError,
    setReviewSubmitting,
    handleSubmitReview,
    clearReviewError,
    clearReviewSaveNotice,
  };
}

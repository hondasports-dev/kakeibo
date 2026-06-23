import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { emptyReviewForm, mapDraftToReviewForm } from "../utils/mappers";
import { isDraftWithItems } from "../utils/mappers";
import type {
  AiExpenseQueuePanelProps,
  AiExpenseDraft,
  AiExpenseDraftWithItems,
  ReviewFormValues,
} from "../types/types";

export function useReviewDialog({
  initialReviewDrafts,
  onReviewSubmit,
  onRegister,
}: {
  initialReviewDrafts: Record<string, AiExpenseDraft>;
  onReviewSubmit?: AiExpenseQueuePanelProps["onReviewSubmit"];
  onRegister?: (draftId: string) => void;
}) {
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);
  const [initializedReviewDraftId, setInitializedReviewDraftId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormValues>(emptyReviewForm);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const localReviewDraft = selectedReviewDraftId
    ? initialReviewDrafts[selectedReviewDraftId]
    : undefined;
  const selectedReviewDraftDetails = useQuery(
    api.aiExpenseDrafts.queries.getWithItems,
    selectedReviewDraftId && !localReviewDraft
      ? { draftId: selectedReviewDraftId as Id<"aiExpenseDrafts"> }
      : "skip",
  ) as AiExpenseDraftWithItems | null | undefined;

  const selectedReviewDraft = localReviewDraft
    ? localReviewDraft
    : isDraftWithItems(selectedReviewDraftDetails)
      ? selectedReviewDraftDetails.draft
      : null;
  const isReviewDraftNotFound =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === null;
  const isReviewDraftLoading =
    selectedReviewDraftId !== null && !localReviewDraft && selectedReviewDraftDetails === undefined;

  const updateForReview = useMutation(api.aiExpenseDrafts.mutations.updateForReview);
  const registerReadyDraftsAsExpenseEntries = useMutation(
    api.aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries,
  );

  useEffect(() => {
    if (
      selectedReviewDraft &&
      selectedReviewDraft._id === selectedReviewDraftId &&
      initializedReviewDraftId !== selectedReviewDraft._id
    ) {
      setReviewForm(mapDraftToReviewForm(selectedReviewDraft));
      setInitializedReviewDraftId(selectedReviewDraft._id);
    }
  }, [initializedReviewDraftId, selectedReviewDraft, selectedReviewDraftId]);

  const handleOpenReview = (itemId: string) => {
    setSelectedReviewDraftId(itemId);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewError("");
  };

  const handleCloseReview = () => {
    if (reviewSubmitting) {
      return;
    }
    setSelectedReviewDraftId(null);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewError("");
  };

  const handleReviewFieldChange = (field: keyof ReviewFormValues, value: string) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitReview = async (registerAfterUpdate: boolean) => {
    if (!selectedReviewDraftId) {
      return;
    }
    const amountYen = Number(reviewForm.amountYen);
    if (reviewForm.documentType === "unknown") {
      setReviewError("書類種別を選択してください。");
      return;
    }
    if (
      !reviewForm.date ||
      !Number.isInteger(amountYen) ||
      amountYen <= 0 ||
      !reviewForm.categoryId
    ) {
      setReviewError("日付、金額、カテゴリを確認してください。");
      return;
    }

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
        });

        if (registerAfterUpdate) {
          onRegister?.(selectedReviewDraftId);
          await registerReadyDraftsAsExpenseEntries({
            draftIds: [selectedReviewDraftId as Id<"aiExpenseDrafts">],
          });
        }
      }

      setSelectedReviewDraftId(null);
      setInitializedReviewDraftId(null);
      setReviewForm(emptyReviewForm);
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "下書きの更新に失敗しました。もう一度お試しください。",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  return {
    selectedReviewDraftId,
    initializedReviewDraftId,
    selectedReviewDraft,
    isReviewDraftLoading,
    isReviewDraftNotFound,
    reviewForm,
    reviewError,
    reviewSubmitting,
    setSelectedReviewDraftId,
    setInitializedReviewDraftId,
    setReviewForm,
    setReviewError,
    setReviewSubmitting,
    handleOpenReview,
    handleCloseReview,
    handleReviewFieldChange,
    handleSubmitReview,
  };
}

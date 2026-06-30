import { useEffect, useState } from "react";
import {
  emptyReviewForm,
  mapDraftItemsToReviewItems,
  mapDraftToReviewForm,
} from "../../utils/mappers";
import { isDraftWithItems } from "../../utils/mappers";
import type {
  AiExpenseDraft,
  AiExpenseDraftItem,
  AiExpenseDraftWithItems,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";

export function useReviewFormState({
  selectedReviewDraftId,
  selectedReviewDraft,
  localReviewItems,
  selectedReviewDraftDetails,
}: {
  selectedReviewDraftId: string | null;
  selectedReviewDraft: AiExpenseDraft | null;
  localReviewItems: AiExpenseDraftItem[] | undefined;
  selectedReviewDraftDetails: AiExpenseDraftWithItems | null | undefined;
}) {
  const [initializedReviewDraftId, setInitializedReviewDraftId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormValues>(emptyReviewForm);
  const [reviewItems, setReviewItems] = useState<ReviewItemValues[]>([]);

  useEffect(() => {
    if (
      selectedReviewDraft &&
      selectedReviewDraft._id === selectedReviewDraftId &&
      initializedReviewDraftId !== selectedReviewDraft._id
    ) {
      setReviewForm(mapDraftToReviewForm(selectedReviewDraft));
      setReviewItems(
        localReviewItems
          ? mapDraftItemsToReviewItems(localReviewItems)
          : isDraftWithItems(selectedReviewDraftDetails)
            ? mapDraftItemsToReviewItems(selectedReviewDraftDetails.items)
            : [],
      );
      setInitializedReviewDraftId(selectedReviewDraft._id);
    }
  }, [
    initializedReviewDraftId,
    localReviewItems,
    selectedReviewDraft,
    selectedReviewDraftDetails,
    selectedReviewDraftId,
  ]);

  const resetForm = () => {
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewItems([]);
  };

  const prepareForDraft = () => {
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewItems([]);
  };

  const handleReviewFieldChange = (field: keyof ReviewFormValues, value: string) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
  };

  const handleReviewItemChange = (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => {
    setReviewItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddReviewItem = () => {
    setReviewItems((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        itemName: "",
        amountYen: "",
        categoryId: "",
      },
    ]);
  };

  const handleRemoveReviewItem = (itemId: string) => {
    setReviewItems((current) => current.filter((item) => item.id !== itemId));
  };

  return {
    initializedReviewDraftId,
    setInitializedReviewDraftId,
    reviewForm,
    reviewItems,
    setReviewForm,
    setReviewItems,
    resetForm,
    prepareForDraft,
    handleReviewFieldChange,
    handleReviewItemChange,
    handleAddReviewItem,
    handleRemoveReviewItem,
  };
}

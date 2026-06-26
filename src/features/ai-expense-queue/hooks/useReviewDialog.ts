import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import {
  emptyReviewForm,
  mapDraftItemsToReviewItems,
  mapDraftToReviewForm,
} from "../utils/mappers";
import { isDraftWithItems } from "../utils/mappers";
import { getReviewFormError } from "../utils/reviewValidation";
import { toUserFacingReviewError } from "../utils/userFacingErrors";
import type {
  AiExpenseQueuePanelProps,
  AiExpenseDraft,
  AiExpenseDraftItem,
  AiExpenseDraftWithItems,
  ReviewItemValues,
  ReviewFormValues,
} from "../types/types";

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
  const [selectedReviewDraftId, setSelectedReviewDraftId] = useState<string | null>(null);
  const [initializedReviewDraftId, setInitializedReviewDraftId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormValues>(emptyReviewForm);
  const [reviewItems, setReviewItems] = useState<ReviewItemValues[]>([]);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const localReviewDraft = selectedReviewDraftId
    ? initialReviewDrafts[selectedReviewDraftId]
    : undefined;
  const localReviewItems = selectedReviewDraftId
    ? initialReviewDraftItems[selectedReviewDraftId]
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

  const handleOpenReview = (itemId: string) => {
    setSelectedReviewDraftId(itemId);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewItems([]);
    setReviewError("");
  };

  const handleCloseReview = () => {
    if (reviewSubmitting) {
      return;
    }
    setSelectedReviewDraftId(null);
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewItems([]);
    setReviewError("");
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

  const handleSubmitReview = async (registerAfterUpdate: boolean) => {
    if (!selectedReviewDraftId) {
      return;
    }
    if (reviewForm.documentType === "unknown") {
      setReviewError("書類種別を選択してください。");
      return;
    }
    const validationError = getReviewFormError(reviewForm);
    if (validationError) {
      setReviewError(validationError);
      return;
    }
    const amountYen = Number(reviewForm.amountYen);
    const invalidItem = reviewItems.find((item) => {
      const itemAmount = Number(item.amountYen);
      return (
        !item.itemName.trim() ||
        !Number.isInteger(itemAmount) ||
        itemAmount <= 0 ||
        !item.categoryId
      );
    });
    if (invalidItem) {
      setReviewError("明細名、明細金額、明細カテゴリを確認してください。");
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
            items: reviewItems.map((item) => ({
              ...item,
              itemName: item.itemName.trim(),
              amountYen: Number(item.amountYen),
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
          items: reviewItems.map((item) => ({
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

      setSelectedReviewDraftId(null);
      setInitializedReviewDraftId(null);
      setReviewForm(emptyReviewForm);
      setReviewItems([]);
    } catch (error) {
      setReviewError(toUserFacingReviewError(error));
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
    reviewItems,
    reviewError,
    reviewSubmitting,
    setSelectedReviewDraftId,
    setInitializedReviewDraftId,
    setReviewForm,
    setReviewItems,
    setReviewError,
    setReviewSubmitting,
    handleOpenReview,
    handleCloseReview,
    handleReviewFieldChange,
    handleReviewItemChange,
    handleAddReviewItem,
    handleRemoveReviewItem,
    handleSubmitReview,
  };
}

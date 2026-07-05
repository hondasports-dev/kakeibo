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
import {
  applyReceiptCategory,
  assignCategoryToItems,
  assignDiscountTarget,
  initializeReviewCategoryState,
  prepareReviewItemsForSubmit,
} from "../../utils/reviewItemCategories";
import { isDiscountItemName } from "../../utils/discountItems";

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
  const [isCategorySplit, setIsCategorySplit] = useState(false);

  useEffect(() => {
    if (
      selectedReviewDraft &&
      selectedReviewDraft._id === selectedReviewDraftId &&
      initializedReviewDraftId !== selectedReviewDraft._id
    ) {
      const mappedForm = mapDraftToReviewForm(selectedReviewDraft);
      const mappedItems = localReviewItems
        ? mapDraftItemsToReviewItems(localReviewItems)
        : isDraftWithItems(selectedReviewDraftDetails)
          ? mapDraftItemsToReviewItems(selectedReviewDraftDetails.items)
          : [];
      const categoryState = initializeReviewCategoryState(mappedItems, mappedForm.categoryId);
      setReviewForm({ ...mappedForm, categoryId: categoryState.receiptCategoryId });
      setReviewItems(categoryState.items);
      setIsCategorySplit(categoryState.isCategorySplit);
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
    setIsCategorySplit(false);
  };

  const prepareForDraft = () => {
    setInitializedReviewDraftId(null);
    setReviewForm(emptyReviewForm);
    setReviewItems([]);
    setIsCategorySplit(false);
  };

  const handleReviewFieldChange = (field: keyof ReviewFormValues, value: string) => {
    setReviewForm((current) => ({ ...current, [field]: value }));
    if (field === "categoryId") {
      setReviewItems((current) =>
        isCategorySplit
          ? prepareReviewItemsForSubmit(current, value)
          : applyReceiptCategory(current, value),
      );
    }
  };

  const handleReviewItemChange = (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => {
    setReviewItems((current) => {
      const targetItem = current.find((item) => item.id === itemId);
      if (field === "categoryId" && targetItem && !isDiscountItemName(targetItem.itemName)) {
        return assignCategoryToItems(current, [itemId], value);
      }
      return current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        if (field === "categoryId") {
          return {
            ...item,
            categoryId: value,
            discountTargetItemId: undefined,
          };
        }
        if (field === "amountYen") {
          const amountNum = Number(value);
          if (!Number.isFinite(amountNum)) {
            return { ...item, amountYen: value };
          }
          if (item.taxResolutionStatus === "resolved" && item.amountBasis === "tax_included") {
            return {
              ...item,
              amountYen: value,
              printedAmountYen: amountNum,
              normalizedAmountYen: amountNum,
            };
          }
          return {
            ...item,
            amountYen: value,
            printedAmountYen: amountNum,
            normalizedAmountYen:
              item.taxResolutionStatus === "resolved" && item.amountBasis === "tax_excluded"
                ? undefined
                : item.normalizedAmountYen,
          };
        }
        if (field !== "itemName") {
          return { ...item, [field]: value };
        }
        const wasDiscount = isDiscountItemName(item.itemName);
        const isDiscount = isDiscountItemName(value);
        if (!wasDiscount && isDiscount) {
          return {
            ...item,
            itemName: value,
            categoryId: "",
            usesReceiptCategory: false,
            discountTargetItemId: undefined,
          };
        }
        if (wasDiscount && !isDiscount) {
          return {
            ...item,
            itemName: value,
            categoryId: reviewForm.categoryId,
            usesReceiptCategory: true,
            discountTargetItemId: undefined,
          };
        }
        return { ...item, itemName: value };
      });
    });
  };

  const handleAddReviewItem = () => {
    setReviewItems((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        itemName: "",
        amountYen: "",
        categoryId: reviewForm.categoryId,
        usesReceiptCategory: true,
      },
    ]);
  };

  const handleRemoveReviewItem = (itemId: string) => {
    setReviewItems((current) =>
      current
        .filter((item) => item.id !== itemId)
        .map((item) =>
          item.discountTargetItemId === itemId
            ? { ...item, categoryId: "", discountTargetItemId: undefined }
            : item,
        ),
    );
  };

  const handleCategorySplitChange = (split: boolean) => {
    setIsCategorySplit(split);
    if (!split) {
      setReviewItems((current) => applyReceiptCategory(current, reviewForm.categoryId));
    }
  };

  const handleAssignCategoryToItems = (itemIds: string[], categoryId: string) => {
    setReviewItems((current) => assignCategoryToItems(current, itemIds, categoryId));
  };

  const handleDiscountTargetChange = (discountItemId: string, targetItemId: string) => {
    setReviewItems((current) => assignDiscountTarget(current, discountItemId, targetItemId));
  };

  return {
    initializedReviewDraftId,
    setInitializedReviewDraftId,
    reviewForm,
    reviewItems,
    isCategorySplit,
    setReviewForm,
    setReviewItems,
    resetForm,
    prepareForDraft,
    handleReviewFieldChange,
    handleReviewItemChange,
    handleAddReviewItem,
    handleRemoveReviewItem,
    handleCategorySplitChange,
    handleAssignCategoryToItems,
    handleDiscountTargetChange,
  };
}

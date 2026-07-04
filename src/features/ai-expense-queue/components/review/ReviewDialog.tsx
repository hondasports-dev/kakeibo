import { useEffect, useState } from "react";
import {
  Alert,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { getReviewReasonLabel } from "../labels";
import type {
  AiExpenseDraft,
  AiExpenseQueueCategory,
  ReviewFormValues,
  ReviewItemValues,
} from "../../types/types";
import { ReviewDialogActions } from "./ReviewDialogActions";
import { ReviewFormFields } from "./ReviewFormFields";
import { ReviewItemsEditor } from "./ReviewItemsEditor";
import { ReviewSummaryView } from "./ReviewSummaryView";
import { formatTaxWarnings } from "../../utils/taxWarnings";

export function ReviewDialog({
  open,
  categories,
  isReviewDraftLoading,
  isReviewDraftNotFound,
  selectedReviewDraft,
  reviewError,
  reviewForm,
  reviewItems,
  isCategorySplit,
  reviewSubmitting,
  onClose,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onCategorySplitChange,
  onAssignCategoryToItems,
  onDiscountTargetChange,
  onSubmit,
}: {
  open: boolean;
  categories: AiExpenseQueueCategory[];
  isReviewDraftLoading: boolean;
  isReviewDraftNotFound: boolean;
  selectedReviewDraft: AiExpenseDraft | null;
  reviewError: string;
  reviewForm: ReviewFormValues;
  reviewItems: ReviewItemValues[];
  isCategorySplit: boolean;
  reviewSubmitting: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof ReviewFormValues, value: string) => void;
  onItemChange: (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onCategorySplitChange: (split: boolean) => void;
  onAssignCategoryToItems: (itemIds: string[], categoryId: string) => void;
  onDiscountTargetChange: (discountItemId: string, targetItemId: string) => void;
  onSubmit: (registerAfterUpdate: boolean) => void;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const hasLineItems = reviewItems.length > 0;
  const hasMultipleCategories =
    new Set(reviewItems.map((item) => item.categoryId).filter(Boolean)).size > 1;
  const showSummaryView = hasLineItems && !isEditMode;
  const receiptAmount = Number(reviewForm.amountYen) || 0;
  const isSubmitDisabled =
    reviewSubmitting || isReviewDraftLoading || isReviewDraftNotFound || categories.length === 0;

  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
      setItemsExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    setIsEditMode(false);
    setItemsExpanded(false);
  }, [selectedReviewDraft?._id]);

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open}
      slotProps={{ paper: { sx: { overscrollBehavior: "contain" } } }}
    >
      <DialogTitle>下書き確認</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isReviewDraftLoading && (
            <Typography color="text.secondary">下書きを読み込んでいます。</Typography>
          )}

          {isReviewDraftNotFound && (
            <Alert severity="error" variant="outlined">
              下書きが見つかりません。一覧を更新してもう一度確認してください。
            </Alert>
          )}

          {!isReviewDraftLoading && !isReviewDraftNotFound && (
            <>
              {reviewError && (
                <Alert severity="error" variant="outlined">
                  {reviewError}
                </Alert>
              )}

              {showSummaryView ? (
                <ReviewSummaryView
                  categories={categories}
                  itemsExpanded={itemsExpanded}
                  onToggleItemsExpanded={() => setItemsExpanded((current) => !current)}
                  reviewForm={reviewForm}
                  reviewItems={reviewItems}
                  selectedReviewDraft={selectedReviewDraft}
                />
              ) : (
                <>
                  {selectedReviewDraft?.reviewReasons &&
                    selectedReviewDraft.reviewReasons.length > 0 && (
                      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                        {selectedReviewDraft.reviewReasons.map((reason) => (
                          <Chip
                            key={reason}
                            label={getReviewReasonLabel(reason)}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}

                  {selectedReviewDraft?.warnings && selectedReviewDraft.warnings.length > 0 && (
                    <Alert severity="warning" variant="outlined">
                      {formatTaxWarnings(selectedReviewDraft.warnings)}
                    </Alert>
                  )}

                  <ReviewFormFields
                    categories={categories}
                    onFieldChange={onFieldChange}
                    reviewForm={reviewForm}
                  />

                  {hasLineItems && (
                    <>
                      <Divider />
                      <ReviewItemsEditor
                        categories={categories}
                        onAddItem={onAddItem}
                        onItemChange={onItemChange}
                        onRemoveItem={onRemoveItem}
                        receiptAmount={receiptAmount}
                        reviewItems={reviewItems}
                        isCategorySplit={isCategorySplit}
                        onCategorySplitChange={onCategorySplitChange}
                        onAssignCategoryToItems={onAssignCategoryToItems}
                        onDiscountTargetChange={onDiscountTargetChange}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <ReviewDialogActions
        hasLineItems={hasLineItems}
        hasMultipleCategories={hasMultipleCategories}
        isSubmitDisabled={isSubmitDisabled}
        onClose={onClose}
        onEnterEditMode={() => setIsEditMode(true)}
        onExitEditMode={() => setIsEditMode(false)}
        onSubmit={onSubmit}
        reviewSubmitting={reviewSubmitting}
        showSummaryView={showSummaryView}
      />
    </Dialog>
  );
}

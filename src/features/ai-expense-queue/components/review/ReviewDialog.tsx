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
import { ReceiptBulkTaxApply } from "./ReceiptBulkTaxApply";
import { ReceiptTotalsPanel } from "./ReceiptTotalsPanel";
import { ReviewDialogActions } from "./ReviewDialogActions";
import { ReviewFormFields } from "./ReviewFormFields";
import { ReviewItemsEditor } from "./ReviewItemsEditor";
import { ReviewSummaryView } from "./ReviewSummaryView";
import type { TaxSummaryChange } from "./ReceiptTaxSummaryEditor";

export function ReviewDialog({
  open,
  categories,
  isReviewDraftLoading,
  isReviewDraftNotFound,
  selectedReviewDraft,
  reviewError,
  reviewSaveNotice,
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
  taxUpdatingItemId,
  onTaxRateChange,
  onApplyReceiptTaxSettings,
  isApplyingReceiptTax,
  taxSummaryUpdatingIndex,
  onTaxSummaryChange,
}: {
  open: boolean;
  categories: AiExpenseQueueCategory[];
  isReviewDraftLoading: boolean;
  isReviewDraftNotFound: boolean;
  selectedReviewDraft: AiExpenseDraft | null;
  reviewError: string;
  reviewSaveNotice?: string;
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
  taxUpdatingItemId?: string | null;
  onTaxRateChange?: (itemId: string, taxRatePercent: 0 | 8 | 10 | null) => void;
  onApplyReceiptTaxSettings?: () => void;
  isApplyingReceiptTax?: boolean;
  taxSummaryUpdatingIndex?: number | null;
  onTaxSummaryChange?: (index: number, change: TaxSummaryChange) => void;
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

  const bulkTaxAction =
    onApplyReceiptTaxSettings && hasLineItems ? (
      <ReceiptBulkTaxApply
        isApplying={isApplyingReceiptTax}
        onApply={onApplyReceiptTaxSettings}
        reviewItems={reviewItems}
        taxSummaries={selectedReviewDraft?.taxSummaries}
      />
    ) : undefined;

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
              {reviewSaveNotice && (
                <Alert severity="info" variant="outlined">
                  {reviewSaveNotice}
                </Alert>
              )}

              {reviewError && (
                <Alert severity="error" variant="outlined">
                  {reviewError}
                </Alert>
              )}

              {showSummaryView ? (
                <ReviewSummaryView
                  categories={categories}
                  isApplyingReceiptTax={isApplyingReceiptTax}
                  itemsExpanded={itemsExpanded}
                  onApplyReceiptTaxSettings={onApplyReceiptTaxSettings}
                  onToggleItemsExpanded={() => setItemsExpanded((current) => !current)}
                  onTaxSummaryChange={onTaxSummaryChange}
                  reviewForm={reviewForm}
                  reviewItems={reviewItems}
                  selectedReviewDraft={selectedReviewDraft}
                  taxSummaryUpdatingIndex={taxSummaryUpdatingIndex}
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

                  {hasLineItems && (
                    <ReceiptTotalsPanel
                      bulkTaxAction={bulkTaxAction}
                      paidTotalYen={receiptAmount || selectedReviewDraft?.amountYen}
                      reviewItems={reviewItems}
                      taxSummaries={selectedReviewDraft?.taxSummaries}
                    />
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
                        onTaxRateChange={onTaxRateChange}
                        receiptAmount={receiptAmount}
                        reviewItems={reviewItems}
                        selectedReviewDraft={selectedReviewDraft}
                        taxUpdatingItemId={taxUpdatingItemId}
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

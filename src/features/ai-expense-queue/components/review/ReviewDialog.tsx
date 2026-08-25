import { useEffect, useState } from "react";
import {
  Alert,
  Box,
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
  onResetToAiInterpretation,
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
  onResetToAiInterpretation: () => void;
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
              {reviewError && (
                <Alert severity="error" variant="outlined">
                  {reviewError}
                </Alert>
              )}

              {selectedReviewDraft?.rawObservation?.lines.length ? (
                <Box aria-label="OCR原文" component="section">
                  <Typography gutterBottom sx={{ fontWeight: 600 }} variant="body2">
                    OCR原文
                  </Typography>
                  <Stack
                    component="ol"
                    spacing={0.5}
                    sx={{ m: 0, maxHeight: 160, overflow: "auto", pl: 3 }}
                  >
                    {selectedReviewDraft.rawObservation.lines.map((line, index) => (
                      <Typography
                        component="li"
                        key={`${line.sourceLineIndex}-${index}`}
                        variant="body2"
                      >
                        {line.rawText}
                        {line.amountText ? `（金額文字列: ${line.amountText}）` : ""}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}

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
        canResetToAiInterpretation={
          selectedReviewDraft?.receiptInterpretation !== undefined &&
          selectedReviewDraft.receiptUserOverride !== undefined
        }
        isSubmitDisabled={isSubmitDisabled}
        onClose={onClose}
        onEnterEditMode={() => setIsEditMode(true)}
        onExitEditMode={() => setIsEditMode(false)}
        onResetToAiInterpretation={onResetToAiInterpretation}
        onSubmit={onSubmit}
        reviewSubmitting={reviewSubmitting}
        showSummaryView={showSummaryView}
      />
    </Dialog>
  );
}

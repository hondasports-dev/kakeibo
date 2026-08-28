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
import { ReceiptTotalsPanel } from "./ReceiptTotalsPanel";
import { ReceiptTaxCorrectionPanel } from "./ReceiptTaxCorrectionPanel";
import { ReviewDialogActions } from "./ReviewDialogActions";
import { ReviewFormFields } from "./ReviewFormFields";
import { ReviewItemsEditor } from "./ReviewItemsEditor";
import { ReviewSummaryView } from "./ReviewSummaryView";
import type { TaxSummaryChange } from "./ReceiptTaxSummaryEditor";
import type { AmountBasis } from "../../../../../lib/receiptTax/types";

const RECEIPT_LINE_ROLE_LABELS = {
  item: "商品",
  itemDiscount: "商品値引き",
  receiptDiscount: "全体値引き",
  coupon: "クーポン",
  pointsUsed: "ポイント利用",
  fee: "手数料・袋代",
  tax: "税",
  subtotal: "小計",
  totalCandidate: "合計候補",
  paymentMethodAmount: "支払方法別金額",
  cashReceived: "預り金",
  change: "釣銭",
  unknown: "不明",
} as const;

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
  taxSummaryUpdatingIndex,
  onTaxSummaryChange,
  imageDataUrl,
  onAmountBasisChange,
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
  onSubmit: (
    registerAfterUpdate: boolean,
    registrationModeOverride?: ReviewFormValues["registrationMode"],
  ) => void;
  onResetToAiInterpretation: () => void;
  taxUpdatingItemId?: string | null;
  onTaxRateChange?: (itemId: string, taxRatePercent: 0 | 8 | 10 | null) => void;
  taxSummaryUpdatingIndex?: number | null;
  onTaxSummaryChange?: (index: number, change: TaxSummaryChange) => void;
  imageDataUrl?: string;
  onAmountBasisChange?: (itemId: string, amountBasis: AmountBasis) => void;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const hasLineItems = reviewItems.length > 0;
  const showSummaryView = hasLineItems && !isEditMode;
  const receiptAmount = Number(reviewForm.amountYen) || 0;
  const lineClassifications =
    selectedReviewDraft?.receiptInterpretation?.values.receiptLineClassifications ?? [];
  const ambiguousLineCount = lineClassifications.filter(
    (classification) => classification.status === "ambiguous",
  ).length;
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
      maxWidth={reviewForm.taxRateComposition === "mixed" ? "lg" : "sm"}
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
                  {ambiguousLineCount > 0 ? (
                    <Alert severity="warning" sx={{ mb: 1 }} variant="outlined">
                      判定が曖昧なOCR行が{ambiguousLineCount}
                      件あります。明細へ未反映の可能性があります。
                    </Alert>
                  ) : null}
                  <Stack
                    component="ol"
                    spacing={0.5}
                    sx={{ m: 0, maxHeight: 160, overflow: "auto", pl: 3 }}
                  >
                    {selectedReviewDraft.rawObservation.lines.map((line, index) => {
                      const classification = lineClassifications.find(
                        (value) => value.sourceLineIndex === line.sourceLineIndex,
                      );
                      const isAmbiguous = classification?.status === "ambiguous";
                      const candidateLabels = classification?.candidates
                        .slice(0, 3)
                        .map((candidate) => RECEIPT_LINE_ROLE_LABELS[candidate.role])
                        .join(" / ");
                      return (
                        <Box
                          aria-label={
                            isAmbiguous ? `要確認 OCR行 ${line.sourceLineIndex}` : undefined
                          }
                          component="li"
                          key={`${line.sourceLineIndex}-${index}`}
                        >
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                            <Typography variant="body2">
                              {line.rawText}
                              {line.amountText ? `（金額文字列: ${line.amountText}）` : ""}
                            </Typography>
                            {isAmbiguous ? (
                              <Chip color="warning" label="要確認" size="small" />
                            ) : null}
                          </Stack>
                          {isAmbiguous && candidateLabels ? (
                            <Typography color="text.secondary" variant="caption">
                              候補: {candidateLabels}・明細へ未反映の可能性
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ) : null}

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

                  {hasLineItems && (
                    <ReceiptTotalsPanel
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
                        enableItemTaxEditing={reviewForm.taxRateComposition === "mixed"}
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

              {hasLineItems ? (
                <ReceiptTaxCorrectionPanel
                  draft={selectedReviewDraft}
                  imageDataUrl={imageDataUrl}
                  onAmountBasisChange={onAmountBasisChange}
                  onFieldChange={onFieldChange}
                  onOpenItemEditing={() => {
                    setIsEditMode(true);
                    setItemsExpanded(true);
                  }}
                  onTaxSummaryChange={onTaxSummaryChange}
                  onTaxRateChange={onTaxRateChange}
                  reviewForm={reviewForm}
                  reviewItems={reviewItems}
                  taxSummaryUpdatingIndex={taxSummaryUpdatingIndex}
                  taxUpdatingItemId={taxUpdatingItemId}
                />
              ) : null}
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

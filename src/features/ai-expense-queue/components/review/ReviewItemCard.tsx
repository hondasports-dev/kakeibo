import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatYen } from "../../../../utils/currency";
import type { AiExpenseQueueCategory, AiExpenseDraft, ReviewItemValues } from "../../types/types";
import { isDiscountItemName, sanitizeSignedYenInput } from "../../utils/discountItems";
import { isLowConfidenceItem } from "../../utils/reviewDialogUtils";
import {
  buildTaxContextFromReviewItem,
  toReceiptItemTaxViewModel,
} from "../../utils/receiptItemTaxViewModel";
import { formatTaxWarnings } from "../../utils/taxWarnings";
import { ReceiptItemTaxDetail } from "./ReceiptItemTaxDetail";
import { ReviewItemCategoryControl } from "./ReviewItemCategoryControl";
import { TaxRateSelect } from "./TaxRateSelect";

export type ReviewItemCardProps = {
  item: ReviewItemValues;
  index: number;
  categories: AiExpenseQueueCategory[];
  categoryNamesById: Map<string, string>;
  productItems: ReviewItemValues[];
  selectedReviewDraft: AiExpenseDraft | null;
  taxUpdatingItemId?: string | null;
  isCategorySplit: boolean;
  isExpanded: boolean;
  enableItemTaxEditing?: boolean;
  onItemChange: (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => void;
  onRemoveItem: (itemId: string) => void;
  onAssignCategoryToItems: (itemIds: string[], categoryId: string) => void;
  onDiscountTargetChange: (discountItemId: string, targetItemId: string) => void;
  onTaxRateChange?: (itemId: string, taxRatePercent: 0 | 8 | 10 | null) => void;
  onToggleDetail: () => void;
};

export function ReviewItemCard({
  item,
  index,
  categories,
  categoryNamesById,
  productItems,
  selectedReviewDraft,
  taxUpdatingItemId,
  isCategorySplit,
  isExpanded,
  enableItemTaxEditing = false,
  onItemChange,
  onRemoveItem,
  onAssignCategoryToItems,
  onDiscountTargetChange,
  onTaxRateChange,
  onToggleDetail,
}: ReviewItemCardProps) {
  const uncategorized = !item.categoryId;
  const lowConfidence = isLowConfidenceItem(item);
  const categoryName = categoryNamesById.get(item.categoryId);
  const taxContext = buildTaxContextFromReviewItem(item);
  const taxVm = toReceiptItemTaxViewModel(item);
  const isTaxUpdating = taxUpdatingItemId === item.id;
  const showTaxRateSelect = enableItemTaxEditing && taxContext.status === "unresolved";
  const showRegistrationAmount =
    taxContext.status === "resolved" &&
    item.amountBasis === "tax_excluded" &&
    item.normalizedAmountYen != null;

  return (
    <Box
      key={item.id}
      sx={{
        border: "1px solid",
        borderColor: uncategorized || lowConfidence ? "warning.main" : "divider",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
            <Chip label={`明細 ${index + 1}`} size="small" />
            {uncategorized && (
              <Chip color="warning" label="未分類" size="small" variant="outlined" />
            )}
            {lowConfidence && (
              <Chip color="warning" label="低信頼度" size="small" variant="outlined" />
            )}
            {taxContext.status === "unresolved" && (
              <Chip color="warning" label="要確認" size="small" variant="outlined" />
            )}
          </Stack>
          <IconButton
            aria-label={`${item.itemName || `明細 ${index + 1}`}を削除`}
            onClick={() => onRemoveItem(item.id)}
            size="small"
            sx={{ minHeight: 44, minWidth: 44 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>

        {item.warnings && item.warnings.length > 0 && (
          <Typography color="warning.main" variant="body2">
            {formatTaxWarnings(item.warnings)}
          </Typography>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            fullWidth
            label="明細名"
            onChange={(event) => onItemChange(item.id, "itemName", event.target.value)}
            slotProps={{ htmlInput: { autoComplete: "off", name: `item-name-${index}` } }}
            value={item.itemName}
          />
          <TextField
            label="レシートの金額"
            onChange={(event) =>
              onItemChange(
                item.id,
                "amountYen",
                sanitizeSignedYenInput(item.itemName, event.target.value),
              )
            }
            slotProps={{
              htmlInput: {
                autoComplete: "off",
                inputMode: isDiscountItemName(item.itemName) ? "text" : "numeric",
                name: `item-amount-${index}`,
              },
            }}
            sx={{ minWidth: { sm: 140 } }}
            value={item.amountYen}
            helperText={
              isDiscountItemName(item.itemName)
                ? "割引額はマイナスで入力"
                : item.amountBasis === "tax_excluded" && taxContext.status === "resolved"
                  ? "税抜の印字額です。登録は下の税込額を使います"
                  : undefined
            }
          />
        </Stack>

        {showRegistrationAmount && item.normalizedAmountYen != null && (
          <Typography color="text.secondary" variant="body2">
            登録額: {formatYen(item.normalizedAmountYen)}（税込）
          </Typography>
        )}

        {taxContext.status === "resolved" && (
          <Typography color="text.secondary" variant="body2">
            税率 {taxVm.taxRateLabel}
          </Typography>
        )}

        <Button
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={onToggleDetail}
          size="small"
          type="button"
          variant="text"
        >
          詳細（通常は不要）
        </Button>
        <Collapse in={isExpanded}>
          <Stack spacing={1} sx={{ pt: 0.5 }}>
            {showTaxRateSelect && (
              <TaxRateSelect
                disabled={isTaxUpdating}
                onChange={(value) => onTaxRateChange?.(item.id, value)}
                value={item.taxRatePercent}
              />
            )}
            <ReceiptItemTaxDetail draft={selectedReviewDraft} item={item} />
          </Stack>
        </Collapse>

        <ReviewItemCategoryControl
          item={item}
          categories={categories}
          categoryName={categoryName}
          productItems={productItems}
          isCategorySplit={isCategorySplit}
          onAssignCategoryToItems={onAssignCategoryToItems}
          onDiscountTargetChange={onDiscountTargetChange}
        />
      </Stack>
    </Box>
  );
}

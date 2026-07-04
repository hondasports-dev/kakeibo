import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import type { AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";
import { isDiscountItemName, sanitizeSignedYenInput } from "../../utils/discountItems";
import { computeItemTotalYen, isLowConfidenceItem } from "../../utils/reviewDialogUtils";
import { formatTaxWarnings } from "../../utils/taxWarnings";
import { ReviewItemTaxDetails } from "./ReviewItemTaxDetails";

export function ReviewItemsEditor({
  categories,
  reviewItems,
  receiptAmount,
  onAddItem,
  onItemChange,
  onRemoveItem,
  isCategorySplit,
  onCategorySplitChange,
  onAssignCategoryToItems,
  onDiscountTargetChange,
}: {
  categories: AiExpenseQueueCategory[];
  reviewItems: ReviewItemValues[];
  receiptAmount: number;
  onAddItem: () => void;
  onItemChange: (
    itemId: string,
    field: keyof Pick<ReviewItemValues, "itemName" | "amountYen" | "categoryId">,
    value: string,
  ) => void;
  onRemoveItem: (itemId: string) => void;
  isCategorySplit: boolean;
  onCategorySplitChange: (split: boolean) => void;
  onAssignCategoryToItems: (itemIds: string[], categoryId: string) => void;
  onDiscountTargetChange: (discountItemId: string, targetItemId: string) => void;
}) {
  const itemTotal = computeItemTotalYen(reviewItems);
  const difference = receiptAmount - itemTotal;
  const productItems = useMemo(
    () => reviewItems.filter((item) => !isDiscountItemName(item.itemName)),
    [reviewItems],
  );
  const categoryNamesById = useMemo(
    () => new Map(categories.map((category) => [category._id, category.name])),
    [categories],
  );
  const handleSplitChange = (split: boolean) => {
    onCategorySplitChange(split);
  };

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
        }}
      >
        <Box>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            明細
          </Typography>
          <Typography color="text.secondary" variant="body2">
            明細合計 {itemTotal.toLocaleString("ja-JP")}円 / 差額{" "}
            {difference.toLocaleString("ja-JP")}円
          </Typography>
        </Box>
        {productItems.length > 1 && (
          <Button
            onClick={() => handleSplitChange(!isCategorySplit)}
            size="small"
            type="button"
            variant="outlined"
          >
            {isCategorySplit ? "単一カテゴリに戻す" : "カテゴリを分ける"}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button
          onClick={onAddItem}
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          type="button"
          variant="text"
        >
          明細を追加
        </Button>
      </Stack>

      {difference !== 0 && reviewItems.length > 0 && (
        <Alert severity="warning" variant="outlined">
          レシート合計と明細合計に差額があります。
        </Alert>
      )}

      {reviewItems.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          明細はありません。既存の単一カテゴリ下書きとして確認できます。
        </Typography>
      ) : (
        <Stack spacing={1}>
          {reviewItems.map((item, index) => {
            const uncategorized = !item.categoryId;
            const lowConfidence = isLowConfidenceItem(item);
            const discount = isDiscountItemName(item.itemName);
            const categoryName = categoryNamesById.get(item.categoryId);
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
                    <Alert severity="warning" variant="outlined">
                      {formatTaxWarnings(item.warnings)}
                    </Alert>
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
                      label="金額"
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
                        isDiscountItemName(item.itemName) ? "割引額はマイナスで入力" : undefined
                      }
                    />
                  </Stack>
                  <ReviewItemTaxDetails item={item} />
                  {discount ? (
                    <TextField
                      fullWidth
                      helperText={
                        item.discountTargetItemId
                          ? "対象商品のカテゴリから減額します"
                          : item.categoryId
                            ? `AI推定カテゴリ: ${categoryName ?? "設定済み"}`
                            : "割引対象の商品を選択してください"
                      }
                      label="割引対象の商品"
                      onChange={(event) => onDiscountTargetChange(item.id, event.target.value)}
                      select
                      value={item.discountTargetItemId ?? ""}
                    >
                      <MenuItem value="">割引対象を選択</MenuItem>
                      {productItems.map((product) => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.itemName}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : isCategorySplit ? (
                    <TextField
                      fullWidth
                      label="明細カテゴリ"
                      onChange={(event) => onAssignCategoryToItems([item.id], event.target.value)}
                      select
                      value={item.categoryId}
                    >
                      {categories.map((category) => (
                        <MenuItem key={category._id} value={category._id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      {item.usesReceiptCategory
                        ? "レシート全体のカテゴリを使用"
                        : `個別カテゴリ: ${categoryName ?? "未分類"}`}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

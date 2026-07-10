import { MenuItem, TextField, Typography } from "@mui/material";
import type { AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";
import { isDiscountItemName } from "../../utils/discountItems";

export type ReviewItemCategoryControlProps = {
  item: ReviewItemValues;
  categories: AiExpenseQueueCategory[];
  categoryName: string | undefined;
  productItems: ReviewItemValues[];
  isCategorySplit: boolean;
  onAssignCategoryToItems: (itemIds: string[], categoryId: string) => void;
  onDiscountTargetChange: (discountItemId: string, targetItemId: string) => void;
};

export function ReviewItemCategoryControl({
  item,
  categories,
  categoryName,
  productItems,
  isCategorySplit,
  onAssignCategoryToItems,
  onDiscountTargetChange,
}: ReviewItemCategoryControlProps) {
  const discount = isDiscountItemName(item.itemName);

  if (discount) {
    return (
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
    );
  }

  if (isCategorySplit) {
    return (
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
    );
  }

  return (
    <Typography color="text.secondary" variant="body2">
      {item.usesReceiptCategory
        ? "レシート全体のカテゴリを使用"
        : `個別カテゴリ: ${categoryName ?? "未分類"}`}
    </Typography>
  );
}

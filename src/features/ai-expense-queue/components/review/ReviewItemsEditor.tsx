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
import type { AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";
import { isDiscountItemName, sanitizeSignedYenInput } from "../../utils/discountItems";
import { computeItemTotalYen, isLowConfidenceItem } from "../../utils/reviewDialogUtils";

export function ReviewItemsEditor({
  categories,
  reviewItems,
  receiptAmount,
  onAddItem,
  onItemChange,
  onRemoveItem,
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
}) {
  const itemTotal = computeItemTotalYen(reviewItems);
  const difference = receiptAmount - itemTotal;

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
        <Button
          onClick={onAddItem}
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          type="button"
          variant="outlined"
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
                      {item.warnings.join(" / ")}
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
                  <TextField
                    fullWidth
                    label="明細カテゴリ"
                    onChange={(event) => onItemChange(item.id, "categoryId", event.target.value)}
                    select
                    value={item.categoryId}
                  >
                    <MenuItem value="">カテゴリ未分類</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category._id} value={category._id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

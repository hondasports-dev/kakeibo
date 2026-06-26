import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { formatDateForDisplay } from "../../week";
import type { ReceiptItem } from "../types/types";

export function ReceiptRow({
  receipt,
  onDelete,
  onEdit,
}: {
  receipt: ReceiptItem;
  onDelete?: (receipt: ReceiptItem) => void;
  onEdit?: (receipt: ReceiptItem) => void;
}) {
  const displayName =
    receipt.type === "income" ? (receipt.bankName ?? "不明") : (receipt.shopName ?? "不明");
  const actionLabelSuffix = `${displayName}（${formatDateForDisplay(receipt.date)}）`;

  return (
    <Box className="receipt-row" key={receipt._id}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: receipt.categoryColor,
              flexShrink: 0,
            }}
          />
          {receipt.type && (
            <Chip
              label={receipt.type === "income" ? "収入" : "支出"}
              size="small"
              color={receipt.type === "income" ? "warning" : "default"}
              variant="outlined"
            />
          )}
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {receipt.type === "income"
              ? (receipt.bankName ?? "不明")
              : (receipt.shopName ?? "不明")}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
          <Typography color="text.secondary" variant="body2">
            {formatDateForDisplay(receipt.date)}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {receipt.categoryName}
          </Typography>
          {receipt.memo && (
            <Typography color="text.secondary" variant="caption">
              メモあり
            </Typography>
          )}
        </Stack>
        {(onEdit || onDelete) && (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            {onEdit && (
              <Button
                aria-label={`${actionLabelSuffix}を編集`}
                onClick={() => onEdit(receipt)}
                size="small"
                startIcon={<EditIcon fontSize="small" />}
                type="button"
                variant="outlined"
              >
                編集
              </Button>
            )}
            {onDelete && (
              <Button
                aria-label={`${actionLabelSuffix}を削除`}
                color="error"
                onClick={() => onDelete(receipt)}
                size="small"
                startIcon={<DeleteIcon fontSize="small" />}
                type="button"
                variant="text"
              >
                削除
              </Button>
            )}
          </Stack>
        )}
      </Box>
      <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>
        {receipt.amountYen.toLocaleString()}円
      </Typography>
    </Box>
  );
}

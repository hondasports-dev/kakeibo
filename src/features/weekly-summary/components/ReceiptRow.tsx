import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { formatDateForDisplay } from "../../week";
import { MemoExpandableText } from "./MemoExpandableText";
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
    <Box className="receipt-row" data-testid="receipt-row" key={receipt._id} role="row">
      <Typography className="receipt-row-date" color="text.secondary" role="cell" variant="body2">
        {formatDateForDisplay(receipt.date)}
      </Typography>
      <Box className="receipt-row-name" role="cell">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
      </Box>
      <Stack
        className="receipt-row-category"
        direction="row"
        role="cell"
        spacing={0.75}
        sx={{ alignItems: "center" }}
      >
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: receipt.categoryColor,
            flexShrink: 0,
          }}
        />
        <Typography color="text.secondary" variant="body2">
          {receipt.categoryName}
        </Typography>
      </Stack>
      <Typography className="receipt-row-amount" role="cell" sx={{ fontWeight: 700 }}>
        {receipt.amountYen.toLocaleString()}円
      </Typography>
      <Box className="receipt-row-memo" role="cell">
        {receipt.memo ? (
          <MemoExpandableText memo={receipt.memo} />
        ) : (
          <Typography color="text.secondary" variant="caption">
            —
          </Typography>
        )}
      </Box>
      <Box className="receipt-row-actions" role="cell">
        {(onEdit || onDelete) && (
          <Stack direction="row" spacing={0.5}>
            {onEdit && (
              <Button
                aria-label={`${actionLabelSuffix}を編集`}
                onClick={() => onEdit(receipt)}
                size="small"
                startIcon={<EditIcon fontSize="small" />}
                sx={{ minHeight: 44 }}
                type="button"
                variant="text"
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
                sx={{ minHeight: 44 }}
                type="button"
                variant="text"
              >
                削除
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

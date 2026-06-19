import { Box, Chip, Stack, Typography } from "@mui/material";
import { formatDateForDisplay } from "../../../lib/dateFormat";
import type { ReceiptItem } from "../types/types";

export function ReceiptRow({ receipt }: { receipt: ReceiptItem }) {
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
      </Box>
      <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>
        {receipt.amountYen.toLocaleString()}円
      </Typography>
    </Box>
  );
}

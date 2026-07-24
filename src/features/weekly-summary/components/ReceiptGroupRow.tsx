import { Box, Chip, Stack, Typography } from "@mui/material";
import { formatDateForDisplay } from "../../week";
import { ReceiptRow } from "./ReceiptRow";
import type { ReceiptGroup, ReceiptItem } from "../types/types";

export function ReceiptGroupRow({
  group,
  onDelete,
  onEdit,
}: {
  group: ReceiptGroup;
  onDelete?: (receipt: ReceiptItem) => void;
  onEdit?: (receipt: ReceiptItem) => void;
}) {
  const singleItem = group.items[0];
  const hasBreakdown =
    group.items.length > 1 || group.items.some((item) => item.itemName !== undefined);

  if (singleItem && !hasBreakdown) {
    return <ReceiptRow receipt={singleItem} onDelete={onDelete} onEdit={onEdit} />;
  }

  return (
    <Box
      aria-label={`${group.shopName}の支出`}
      className="receipt-group"
      data-testid="receipt-group"
      role="rowgroup"
    >
      <Box className="receipt-row receipt-group-header" role="row">
        <Typography className="receipt-row-date" color="text.secondary" role="cell" variant="body2">
          {formatDateForDisplay(group.date)}
        </Typography>
        <Box className="receipt-row-name" role="cell">
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip label="支出" size="small" variant="outlined" />
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {group.shopName}
            </Typography>
          </Stack>
          <Typography color="text.secondary" variant="caption">
            {group.items.some((item) => item.itemName !== undefined)
              ? `内訳 ${group.items.length}件`
              : "内訳情報なし"}
          </Typography>
        </Box>
        <Typography className="receipt-row-amount" role="cell" sx={{ fontWeight: 700 }}>
          {group.amountYen.toLocaleString()}円
        </Typography>
        <Box className="receipt-row-memo" role="cell" />
        <Box className="receipt-row-actions" role="cell" />
      </Box>

      <Box className="receipt-group-details">
        {group.items.map((item) => (
          <ReceiptRow
            key={item._id}
            isDetail
            receipt={item}
            showCategory={item.itemName !== undefined}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </Box>
    </Box>
  );
}

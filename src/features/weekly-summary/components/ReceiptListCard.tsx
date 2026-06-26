import { Box, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { AnimatedCounter } from "../../ui";
import { ReceiptRow } from "./ReceiptRow";
import type { ReceiptItem } from "../types/types";

export function ReceiptListCard({
  count,
  isLoading,
  receipts,
  onDeleteReceipt,
  onEditReceipt,
}: {
  count: number;
  isLoading: boolean;
  receipts: ReceiptItem[];
  onDeleteReceipt?: (receipt: ReceiptItem) => void;
  onEditReceipt?: (receipt: ReceiptItem) => void;
}) {
  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography component="h2" variant="h6">
              支出一覧
            </Typography>
            <Typography color="text.secondary" variant="body2">
              <AnimatedCounter value={count} suffix="件" />
            </Typography>
          </Stack>

          <Box aria-label="週次サマリーの支出一覧" className="receipt-list">
            {isLoading ? (
              <>
                <Skeleton variant="text" height={40} />
                <Skeleton variant="text" height={40} />
                <Skeleton variant="text" height={40} />
              </>
            ) : count === 0 ? (
              <Typography color="text.secondary" variant="body2">
                まだレシートがありません
              </Typography>
            ) : (
              receipts.map((receipt) => (
                <ReceiptRow
                  key={receipt._id}
                  receipt={receipt}
                  onDelete={onDeleteReceipt}
                  onEdit={onEditReceipt}
                />
              ))
            )}
          </Box>
          <Divider />
        </Stack>
      </Box>
    </Paper>
  );
}

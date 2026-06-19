import { Box, Dialog, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import { AnimatedCounter } from "../../ui";
import { formatDateForDisplay } from "../../week";
import { ReceiptRow } from "./ReceiptRow";
import type { ReceiptItem } from "../types/types";

export function DailyComparisonDialog({
  currentDayReceipts,
  currentDayTotal,
  dialogOpen,
  onClose,
  previousDate,
  previousDayReceipts,
  previousDayTotal,
  selectedDate,
}: {
  currentDayReceipts: ReceiptItem[];
  currentDayTotal: number;
  dialogOpen: boolean;
  onClose: () => void;
  previousDate: string | null;
  previousDayReceipts: ReceiptItem[];
  previousDayTotal: number;
  selectedDate: string | null;
}) {
  return (
    <Dialog open={dialogOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {selectedDate ? `${formatDateForDisplay(selectedDate)} の入出金比較` : "入出金比較"}
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", md: "row" }} divider={<Divider flexItem />} spacing={3}>
          <DailyReceiptColumn
            date={previousDate}
            emptyLabel="レシートがありません"
            label="前週"
            receipts={previousDayReceipts}
            total={previousDayTotal}
          />
          <DailyReceiptColumn
            date={selectedDate}
            emptyLabel="レシートがありません"
            label="今週"
            receipts={currentDayReceipts}
            total={currentDayTotal}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function DailyReceiptColumn({
  date,
  emptyLabel,
  label,
  receipts,
  total,
}: {
  date: string | null;
  emptyLabel: string;
  label: string;
  receipts: ReceiptItem[];
  total: number;
}) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography gutterBottom variant="subtitle1">
        {label}（{date ? formatDateForDisplay(date) : ""}）
      </Typography>
      <Typography variant="h6">
        <AnimatedCounter value={total} suffix="円" />
      </Typography>
      <Box className="receipt-list" sx={{ mt: 1 }}>
        {receipts.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {emptyLabel}
          </Typography>
        ) : (
          receipts.map((receipt) => <ReceiptRow key={receipt._id} receipt={receipt} />)
        )}
      </Box>
    </Box>
  );
}

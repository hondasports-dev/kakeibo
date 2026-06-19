import { useState } from "react";
import { addDays, addWeeks } from "../../../lib/weekNavigation";
import type { ReceiptItem } from "../types/types";

export function useDailyComparison({
  prevWeekReceipts,
  receipts,
  weekStartDate,
}: {
  prevWeekReceipts: ReceiptItem[];
  receipts: ReceiptItem[];
  weekStartDate: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePointClick = (date: string) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedDate(null);
  };

  const previousWeekStart = addWeeks(weekStartDate, -1);
  const dayOffset = selectedDate
    ? Math.round(
        (new Date(selectedDate + "T00:00:00Z").getTime() -
          new Date(weekStartDate + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  const previousDate = selectedDate ? addDays(previousWeekStart, dayOffset) : null;
  const currentDayReceipts = selectedDate ? receipts.filter((r) => r.date === selectedDate) : [];
  const previousDayReceipts = previousDate
    ? prevWeekReceipts.filter((r) => r.date === previousDate)
    : [];

  return {
    currentDayReceipts,
    currentDayTotal: currentDayReceipts.reduce((sum, r) => sum + r.amountYen, 0),
    dialogOpen,
    handleClose,
    handlePointClick,
    previousDate,
    previousDayReceipts,
    previousDayTotal: previousDayReceipts.reduce((sum, r) => sum + r.amountYen, 0),
    selectedDate,
  };
}

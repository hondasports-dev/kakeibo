import { addDays } from "../../week";

export type DailySpendingPulseReceipt = {
  date: string;
  amountYen: number;
};

export type DailySpendingPulseDay = {
  amountYen: number;
  date: string;
  isFuture: boolean;
  isToday: boolean;
  label: string;
};

export type DailySpendingPulse = {
  activeDayCount: number;
  days: DailySpendingPulseDay[];
  maxAmountYen: number;
  totalAmountYen: number;
};

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

export function buildDailySpendingPulse({
  receipts,
  todayDate,
  weekStartDate,
}: {
  receipts: DailySpendingPulseReceipt[];
  todayDate: string;
  weekStartDate: string;
}): DailySpendingPulse {
  const amountByDate = new Map<string, number>();
  for (const receipt of receipts) {
    if (receipt.date < weekStartDate || receipt.date > addDays(weekStartDate, 6)) {
      continue;
    }
    amountByDate.set(receipt.date, (amountByDate.get(receipt.date) ?? 0) + receipt.amountYen);
  }

  const days = DAY_LABELS.map((label, index) => {
    const date = addDays(weekStartDate, index);
    return {
      amountYen: amountByDate.get(date) ?? 0,
      date,
      isFuture: date > todayDate,
      isToday: date === todayDate,
      label,
    };
  });

  return {
    activeDayCount: days.filter((day) => day.amountYen > 0).length,
    days,
    maxAmountYen: Math.max(...days.map((day) => day.amountYen), 0),
    totalAmountYen: days.reduce((total, day) => total + day.amountYen, 0),
  };
}

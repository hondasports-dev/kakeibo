export type WeeklyExpenseChartItem = {
  weekStartDate: string;
  weekEndDate: string;
  label: string;
  amount: number;
  previousDiff: number | null;
  averageDiff: number | null;
  averageRate: number | null;
};

type WeeklyExpenseSource = {
  weekStartDate: string;
  totalAmountYen: number;
};

const currencyFormatter = new Intl.NumberFormat("ja-JP");

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

function formatDiff(value: number | null): string {
  if (value === null) return "比較データなし";
  const sign = value > 0 ? "+" : "";
  return `${sign}${currencyFormatter.format(value)}円`;
}

export function buildWeeklyExpenseChartData({
  weeks,
  targetWeekStartDate,
  currentWeekStartDate,
}: {
  weeks: WeeklyExpenseSource[];
  targetWeekStartDate: string;
  currentWeekStartDate: string;
}): WeeklyExpenseChartItem[] {
  const sortedWeeks = [...weeks].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const displayStartIndex = Math.max(0, sortedWeeks.length - 3);
  const isCurrentWeek = targetWeekStartDate === currentWeekStartDate;

  return sortedWeeks.slice(displayStartIndex).map((week, displayIndex, displayedWeeks) => {
    const sourceIndex = displayStartIndex + displayIndex;
    const previousWeek = sortedWeeks[sourceIndex - 1];
    const averageSources = sortedWeeks.slice(Math.max(0, sourceIndex - 2), sourceIndex);
    const average =
      averageSources.length > 0
        ? averageSources.reduce((sum, item) => sum + item.totalAmountYen, 0) / averageSources.length
        : null;
    const distanceFromTarget = displayedWeeks.length - 1 - displayIndex;

    let label = `${formatMonthDay(week.weekStartDate)}週`;
    if (isCurrentWeek) {
      label =
        distanceFromTarget === 0
          ? "今週"
          : distanceFromTarget === 1
            ? "先週"
            : `${distanceFromTarget}週前`;
    }

    return {
      weekStartDate: week.weekStartDate,
      weekEndDate: addDays(week.weekStartDate, 6),
      label,
      amount: week.totalAmountYen,
      previousDiff: previousWeek ? week.totalAmountYen - previousWeek.totalAmountYen : null,
      averageDiff:
        average !== null && average !== 0 ? Math.round(week.totalAmountYen - average) : null,
      averageRate:
        average !== null && average !== 0
          ? Math.round(((week.totalAmountYen - average) / average) * 100)
          : null,
    };
  });
}

export function formatWeeklyExpenseTooltip(item: WeeklyExpenseChartItem): string {
  return [
    `${formatMonthDay(item.weekStartDate)}〜${formatMonthDay(item.weekEndDate)}`,
    `支出合計 ${currencyFormatter.format(item.amount)}円`,
    `前週差 ${formatDiff(item.previousDiff)}`,
    `平均との差 ${formatDiff(item.averageDiff)}`,
  ].join("｜");
}

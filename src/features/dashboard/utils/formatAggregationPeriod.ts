const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatDatePart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayLabel = DAY_LABELS[date.getDay()];
  return `${month}/${day}（${dayLabel}）`;
}

export function formatAggregationPeriod(weekStartDate: string, weekEndDate: string): string {
  return `集計期間：${formatDatePart(weekStartDate)}〜${formatDatePart(weekEndDate)}`;
}

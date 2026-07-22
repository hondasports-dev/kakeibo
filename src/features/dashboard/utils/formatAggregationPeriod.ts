import { formatShortDateWithWeekday } from "../../../utils/date";

export function formatAggregationPeriod(weekStartDate: string, weekEndDate: string): string {
  return `集計期間：${formatShortDateWithWeekday(weekStartDate)}〜${formatShortDateWithWeekday(weekEndDate)}`;
}

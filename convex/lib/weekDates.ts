/**
 * 週に関する Convex アダプタ。
 * 純粋なドメインルールは lib/domain/week/weekDates.ts に委ねる。
 */
export {
  calculateWeekEndDate,
  calculateWeekStartDate,
  calculateRelativeWeekStartDate,
  DEFAULT_WEEK_START_DAY,
  getWeekEndDay,
  isValidIsoDateString,
  normalizeWeekStartDay,
} from "../../lib/domain/week/weekDates";

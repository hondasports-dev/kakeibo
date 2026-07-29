/** 既定の週開始曜日（月曜日）。曜日は JavaScript の Date と同じく 0=日〜6=土。 */
export const DEFAULT_WEEK_START_DAY = 1;

/** 週開始曜日を安全な値に正規化する。 */
export function normalizeWeekStartDay(weekStartDay?: number): number {
  return weekStartDay !== undefined &&
    Number.isInteger(weekStartDay) &&
    weekStartDay >= 0 &&
    weekStartDay <= 6
    ? weekStartDay
    : DEFAULT_WEEK_START_DAY;
}

/** 週開始曜日から、7日間の最後の曜日を返す。 */
export function getWeekEndDay(weekStartDay: number): number {
  return (normalizeWeekStartDay(weekStartDay) + 6) % 7;
}

/**
 * 日付文字列（"YYYY-MM-DD"）から指定曜日始まりの週開始日を返す。
 * 例: "2024-01-10"（水曜）を水曜始まりで計算 → "2024-01-10"
 */
export function calculateWeekStartDate(
  dateStr: string,
  weekStartDay: number = DEFAULT_WEEK_START_DAY,
): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.getUTCDay();
  const diff = (day - normalizeWeekStartDay(weekStartDay) + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 週開始日から7日間の週終了日を返す。
 * 例: "2024-01-08" → "2024-01-14"
 */
export function calculateWeekEndDate(weekStartDate: string): string {
  const date = new Date(weekStartDate + "T00:00:00Z");
  date.setDate(date.getDate() + 6);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 週開始日を基準に、指定週数だけ移動した週開始日を返す。
 * 例: ("2024-01-08", -1) → "2024-01-01"
 */
export function calculateRelativeWeekStartDate(weekStartDate: string, weeks: number): string {
  const date = new Date(weekStartDate + "T00:00:00Z");
  date.setDate(date.getDate() + weeks * 7);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 形式かつ実在する日付かを検証する */
export function isValidIsoDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

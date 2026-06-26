/**
 * 日付文字列（"YYYY-MM-DD"）から ISO 8601 準拠の週開始日（月曜日）を返す。
 * 例: "2024-01-10"（水曜）→ "2024-01-08"（月曜）
 */
export function calculateWeekStartDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.getDay(); // 0=日, 1=月, ..., 6=土
  const diff = day === 0 ? -6 : 1 - day; // 月曜始まりに調整
  date.setDate(date.getDate() + diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 週開始日（月曜日）から週終了日（日曜日）を返す。
 * 例: "2024-01-08"（月曜）→ "2024-01-14"（日曜）
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

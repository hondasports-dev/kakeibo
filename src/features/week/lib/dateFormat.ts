/**
 * ISO 形式の日付文字列 (YYYY-MM-DD) を "M/D" 形式にフォーマットする。
 * 例: "2026-05-18" → "5/18"
 */
export function formatDateForDisplay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

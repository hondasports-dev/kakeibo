const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(dateStr: string): Date | null {
  if (!ISO_DATE_PATTERN.test(dateStr)) {
    return null;
  }

  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || toIsoDate(date) !== dateStr) {
    return null;
  }

  return date;
}

export function normalizeWeekStartDate(dateStr: string): string | null {
  const date = parseIsoDate(dateStr);
  if (date === null) {
    return null;
  }

  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return toIsoDate(date);
}

export function addWeeks(weekStartDate: string, weeks: number): string {
  const date = parseIsoDate(weekStartDate);
  if (date === null) {
    throw new Error(`Invalid weekStartDate: ${weekStartDate}`);
  }

  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return toIsoDate(date);
}

export function getWeekEndDate(weekStartDate: string): string {
  const date = parseIsoDate(weekStartDate);
  if (date === null) {
    throw new Error(`Invalid weekStartDate: ${weekStartDate}`);
  }

  date.setUTCDate(date.getUTCDate() + 6);
  return toIsoDate(date);
}

export function isFutureWeek(weekStartDate: string, currentWeekStartDate: string): boolean {
  return weekStartDate > currentWeekStartDate;
}

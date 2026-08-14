import { getTodayDateStringInJapan } from "./date";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function normalizeMonth(value: string): string | null {
  const match = MONTH_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

export function isValidMonth(value: string): boolean {
  return normalizeMonth(value) !== null;
}

export function getMonthStartDate(month: string): string {
  const normalized = normalizeMonth(month);
  if (normalized === null) {
    throw new Error(`Invalid month: ${month}`);
  }
  return `${normalized}-01`;
}

export function addMonths(month: string, amount: number): string {
  const normalized = normalizeMonth(month);
  if (normalized === null || !Number.isInteger(amount)) {
    throw new Error(`Invalid month: ${month}`);
  }

  const [yearString, monthString] = normalized.split("-");
  const year = Number(yearString);
  const monthNumber = Number(monthString);
  const monthIndex = (year - 1) * 12 + (monthNumber - 1) + amount;
  const targetYear = Math.floor(monthIndex / 12) + 1;
  const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;

  if (targetYear < 1 || targetYear > 9999) {
    throw new Error(`Invalid month: ${month}`);
  }

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}`;
}

export function getCurrentMonth(now: Date | number = new Date()): string {
  return getTodayDateStringInJapan(now).slice(0, 7);
}

export function isFutureMonth(month: string, currentMonth: string): boolean {
  const normalizedMonth = normalizeMonth(month);
  const normalizedCurrentMonth = normalizeMonth(currentMonth);
  if (normalizedMonth === null || normalizedCurrentMonth === null) {
    return false;
  }
  return normalizedMonth > normalizedCurrentMonth;
}

export function formatMonthLabel(month: string): string {
  const normalized = normalizeMonth(month);
  if (normalized === null) {
    throw new Error(`Invalid month: ${month}`);
  }

  const [year, monthNumber] = normalized.split("-");
  return `${Number(year)}年${Number(monthNumber)}月`;
}

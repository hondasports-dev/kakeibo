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
  const date = new Date(Date.UTC(Number(yearString), Number(monthString) - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

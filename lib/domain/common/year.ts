import { getTodayDateStringInJapan } from "./date";

const YEAR_PATTERN = /^(\d{4})$/;

export function normalizeYear(value: string): string | null {
  const match = YEAR_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    return null;
  }

  return match[1];
}

export function isValidYear(value: string): boolean {
  return normalizeYear(value) !== null;
}

export function addYears(year: string, amount: number): string {
  const normalized = normalizeYear(year);
  if (normalized === null || !Number.isInteger(amount)) {
    throw new Error(`Invalid year: ${year}`);
  }

  const targetYear = Number(normalized) + amount;
  if (targetYear < 1 || targetYear > 9999) {
    throw new Error(`Invalid year: ${year}`);
  }

  return String(targetYear).padStart(4, "0");
}

export function getCurrentYear(now: Date | number = new Date()): string {
  return getTodayDateStringInJapan(now).slice(0, 4);
}

export function isFutureYear(year: string, currentYear: string): boolean {
  const normalizedYear = normalizeYear(year);
  const normalizedCurrentYear = normalizeYear(currentYear);
  if (normalizedYear === null || normalizedCurrentYear === null) {
    return false;
  }
  return normalizedYear > normalizedCurrentYear;
}

export function formatYearLabel(year: string): string {
  const normalized = normalizeYear(year);
  if (normalized === null) {
    throw new Error(`Invalid year: ${year}`);
  }
  return `${Number(normalized)}年`;
}

export function getYearMonths(year: string): string[] {
  const normalized = normalizeYear(year);
  if (normalized === null) {
    throw new Error(`Invalid year: ${year}`);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${normalized}-${month}`;
  });
}

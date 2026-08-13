import type { Dayjs } from "dayjs";

export {
  addYears,
  formatYearLabel,
  getCurrentYear,
  isFutureYear,
  isValidYear,
  normalizeYear,
} from "../../../../lib/domain/common/year";

export function resolvePickedYear(value: Dayjs | null): string | null {
  if (value === null || !value.isValid()) {
    return null;
  }
  return value.format("YYYY");
}

export function applyPickedYear(value: Dayjs | null, onYearChange: (year: string) => void): void {
  const pickedYear = resolvePickedYear(value);
  if (pickedYear === null) {
    return;
  }
  onYearChange(pickedYear);
}

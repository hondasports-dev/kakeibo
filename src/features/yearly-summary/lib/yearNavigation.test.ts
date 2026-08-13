import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";
import {
  addYears,
  formatYearLabel,
  getCurrentYear,
  isFutureYear,
  normalizeYear,
  applyPickedYear,
  resolvePickedYear,
} from "./yearNavigation";

describe("yearNavigation", () => {
  it("年次サマリー用の年操作を再公開する", () => {
    expect(normalizeYear("2026")).toBe("2026");
    expect(addYears("2026", -1)).toBe("2025");
    expect(formatYearLabel("2026")).toBe("2026年");
    expect(isFutureYear("2027", "2026")).toBe(true);
    expect(getCurrentYear(new Date("2026-01-01T00:00:00+09:00"))).toBe("2026");
  });

  it("年ピッカーの選択値だけを年として返す", () => {
    expect(resolvePickedYear(null)).toBeNull();
    expect(resolvePickedYear(dayjs("invalid"))).toBeNull();
    expect(resolvePickedYear(dayjs("2024-06-15"))).toBe("2024");
  });

  it("有効な年だけピッカー変更を通知する", () => {
    const onYearChange = vi.fn();
    applyPickedYear(null, onYearChange);
    applyPickedYear(dayjs("invalid"), onYearChange);
    expect(onYearChange).not.toHaveBeenCalled();

    applyPickedYear(dayjs("2024-06-15"), onYearChange);
    expect(onYearChange).toHaveBeenCalledWith("2024");
  });
});

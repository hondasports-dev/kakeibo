import { describe, expect, it } from "vitest";
import {
  addYears,
  formatYearLabel,
  getCurrentYear,
  isFutureYear,
  normalizeYear,
} from "./yearNavigation";

describe("yearNavigation", () => {
  it("年次サマリー用の年操作を再公開する", () => {
    expect(normalizeYear("2026")).toBe("2026");
    expect(addYears("2026", -1)).toBe("2025");
    expect(formatYearLabel("2026")).toBe("2026年");
    expect(isFutureYear("2027", "2026")).toBe(true);
    expect(getCurrentYear(new Date("2026-01-01T00:00:00+09:00"))).toBe("2026");
  });
});

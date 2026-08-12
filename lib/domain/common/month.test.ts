import { describe, expect, it } from "vitest";
import {
  addMonths,
  formatMonthLabel,
  getCurrentMonth,
  getMonthStartDate,
  isFutureMonth,
  isValidMonth,
  normalizeMonth,
} from "./month";

describe("normalizeMonth", () => {
  it("YYYY-MM形式を正規化する", () => {
    expect(normalizeMonth("2026-08")).toBe("2026-08");
  });

  it("不正な年月を拒否する", () => {
    expect(normalizeMonth("2026-8")).toBeNull();
    expect(normalizeMonth("2026-00")).toBeNull();
    expect(normalizeMonth("2026-13")).toBeNull();
    expect(normalizeMonth("2026-02-01")).toBeNull();
    expect(normalizeMonth("0000-01")).toBeNull();
  });
});

describe("addMonths", () => {
  it("月を前後に移動する", () => {
    expect(addMonths("2026-08", -1)).toBe("2026-07");
    expect(addMonths("2026-08", 1)).toBe("2026-09");
  });

  it("年をまたぐ", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
  });
});

describe("month display helpers", () => {
  it("月初日を作る", () => {
    expect(getMonthStartDate("2024-02")).toBe("2024-02-01");
  });

  it("不正な月初日を拒否する", () => {
    expect(() => getMonthStartDate("2024-13")).toThrow("Invalid month: 2024-13");
  });

  it("年月を日本語表示する", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026年8月");
  });

  it("日本時間の現在月を返す", () => {
    expect(getCurrentMonth(new Date("2026-08-07T15:00:00Z"))).toBe("2026-08");
  });

  it("日本時間の月替わり境界を正しく判定する", () => {
    expect(getCurrentMonth(new Date("2026-07-31T14:59:59Z"))).toBe("2026-07");
    expect(getCurrentMonth(new Date("2026-07-31T15:00:00Z"))).toBe("2026-08");
  });

  it("未来月だけを判定する", () => {
    expect(isFutureMonth("2026-09", "2026-08")).toBe(true);
    expect(isFutureMonth("2026-08", "2026-08")).toBe(false);
    expect(isFutureMonth("2026-07", "2026-08")).toBe(false);
    expect(isFutureMonth("invalid", "2026-08")).toBe(false);
    expect(isFutureMonth("2026-08", "invalid")).toBe(false);
  });

  it("年月の形式を判定する", () => {
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2026-8")).toBe(false);
  });

  it("整数でない月移動量を拒否する", () => {
    expect(() => addMonths("2026-08", 0.5)).toThrow("Invalid month: 2026-08");
  });

  it("不正な年月表示を拒否する", () => {
    expect(() => formatMonthLabel("2026-13")).toThrow("Invalid month: 2026-13");
  });
});

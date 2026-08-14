import { describe, expect, it } from "vitest";
import {
  addYears,
  formatYearLabel,
  getCurrentYear,
  getYearMonths,
  isFutureYear,
  isValidYear,
  normalizeYear,
} from "./year";

describe("normalizeYear", () => {
  it("YYYY形式を正規化する", () => {
    expect(normalizeYear("2026")).toBe("2026");
    expect(normalizeYear("0001")).toBe("0001");
    expect(normalizeYear("9999")).toBe("9999");
  });

  it("不正な年を拒否する", () => {
    expect(normalizeYear("26")).toBeNull();
    expect(normalizeYear("2026-01")).toBeNull();
    expect(normalizeYear("0000")).toBeNull();
    expect(normalizeYear("abcd")).toBeNull();
    expect(normalizeYear("")).toBeNull();
  });
});

describe("addYears", () => {
  it("年を前後に移動する", () => {
    expect(addYears("2026", -1)).toBe("2025");
    expect(addYears("2026", 1)).toBe("2027");
  });

  it("下位4桁を保ったまま年を移動する", () => {
    expect(addYears("0099", 1)).toBe("0100");
    expect(addYears("0100", -1)).toBe("0099");
  });

  it("0001〜9999の範囲外への移動を拒否する", () => {
    expect(() => addYears("0001", -1)).toThrow("Invalid year: 0001");
    expect(() => addYears("9999", 1)).toThrow("Invalid year: 9999");
  });
});

describe("year display helpers", () => {
  it("年を日本語表示する", () => {
    expect(formatYearLabel("2026")).toBe("2026年");
  });

  it("日本時間の現在年を返す", () => {
    expect(getCurrentYear(new Date("2026-08-07T15:00:00Z"))).toBe("2026");
  });

  it("日本時間の年替わり境界を正しく判定する", () => {
    expect(getCurrentYear(new Date("2025-12-31T14:59:59Z"))).toBe("2025");
    expect(getCurrentYear(new Date("2025-12-31T15:00:00Z"))).toBe("2026");
  });

  it("未来年だけを判定する", () => {
    expect(isFutureYear("2027", "2026")).toBe(true);
    expect(isFutureYear("2026", "2026")).toBe(false);
    expect(isFutureYear("2025", "2026")).toBe(false);
    expect(isFutureYear("invalid", "2026")).toBe(false);
  });

  it("年の12ヶ月を返す", () => {
    expect(getYearMonths("2026")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("不正な年の12ヶ月生成を拒否する", () => {
    expect(() => getYearMonths("26")).toThrow("Invalid year: 26");
  });

  it("isValidYearは正規化可能な年だけを認める", () => {
    expect(isValidYear("2026")).toBe(true);
    expect(isValidYear("2026-01")).toBe(false);
  });
});

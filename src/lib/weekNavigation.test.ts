import { describe, expect, it } from "vitest";
import {
  addWeeks,
  getWeekEndDate,
  isFutureWeek,
  normalizeWeekStartDate,
} from "./weekNavigation";

describe("weekNavigation", () => {
  it("日付文字列を月曜始まりの週開始日に正規化する", () => {
    expect(normalizeWeekStartDate("2026-05-20")).toBe("2026-05-18");
    expect(normalizeWeekStartDate("2026-05-18")).toBe("2026-05-18");
    expect(normalizeWeekStartDate("2026-05-24")).toBe("2026-05-18");
  });

  it("不正な日付文字列は null にする", () => {
    expect(normalizeWeekStartDate("not-a-date")).toBeNull();
    expect(normalizeWeekStartDate("2026-13-40")).toBeNull();
    expect(normalizeWeekStartDate("")).toBeNull();
  });

  it("週開始日から前後の週を7日単位で計算する", () => {
    expect(addWeeks("2026-05-18", -1)).toBe("2026-05-11");
    expect(addWeeks("2026-05-18", 1)).toBe("2026-05-25");
  });

  it("週開始日から週終了日を計算する", () => {
    expect(getWeekEndDate("2026-05-18")).toBe("2026-05-24");
  });

  it("今週より後の週だけ未来週として判定する", () => {
    expect(isFutureWeek("2026-05-25", "2026-05-18")).toBe(true);
    expect(isFutureWeek("2026-05-18", "2026-05-18")).toBe(false);
    expect(isFutureWeek("2026-05-11", "2026-05-18")).toBe(false);
  });
});

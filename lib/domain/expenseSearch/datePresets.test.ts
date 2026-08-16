import { describe, expect, it } from "vitest";
import { getHistoryDatePresetForRange, getHistoryDateRangeForPreset } from "./datePresets";

describe("history date presets", () => {
  const today = "2026-08-16";

  it("今週・今月・先月・直近3か月・今年を計算する", () => {
    expect(getHistoryDateRangeForPreset("thisWeek", today, 1)).toEqual({
      startDate: "2026-08-10",
      endDate: "2026-08-16",
    });
    expect(getHistoryDateRangeForPreset("thisMonth", today)).toEqual({
      startDate: "2026-08-01",
      endDate: today,
    });
    expect(getHistoryDateRangeForPreset("lastMonth", today)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(getHistoryDateRangeForPreset("last3Months", today)).toEqual({
      startDate: "2026-06-01",
      endDate: today,
    });
    expect(getHistoryDateRangeForPreset("thisYear", today)).toEqual({
      startDate: "2026-01-01",
      endDate: today,
    });
  });

  it("プリセットに一致しない期間はカスタムになる", () => {
    expect(
      getHistoryDatePresetForRange({ startDate: "2026-08-01", endDate: "2026-08-15" }, today),
    ).toBe("custom");
    expect(getHistoryDatePresetForRange({ startDate: "2026-08-01", endDate: today }, today)).toBe(
      "thisMonth",
    );
  });
});

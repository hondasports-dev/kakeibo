import { describe, expect, it } from "vitest";
import {
  calculateWeekEndDate,
  calculateWeekStartDate,
  calculateRelativeWeekStartDate,
  DEFAULT_WEEK_START_DAY,
  getWeekEndDay,
  isValidIsoDateString,
  normalizeWeekStartDay,
} from "./weekDates";

describe("DEFAULT_WEEK_START_DAY", () => {
  it("月曜日（1）が既定値", () => {
    expect(DEFAULT_WEEK_START_DAY).toBe(1);
  });
});

describe("normalizeWeekStartDay", () => {
  it.each([1, 2, 3, 4, 5, 6, 0])("有効な曜日 %s をそのまま返す", (day) => {
    expect(normalizeWeekStartDay(day)).toBe(day);
  });

  it("範囲外または undefined の場合は既定値を返す", () => {
    expect(normalizeWeekStartDay(undefined)).toBe(DEFAULT_WEEK_START_DAY);
    expect(normalizeWeekStartDay(-1)).toBe(DEFAULT_WEEK_START_DAY);
    expect(normalizeWeekStartDay(7)).toBe(DEFAULT_WEEK_START_DAY);
    expect(normalizeWeekStartDay(1.5)).toBe(DEFAULT_WEEK_START_DAY);
  });
});

describe("getWeekEndDay", () => {
  it("月曜始まりの場合の週終了曜日は日曜日（0）", () => {
    expect(getWeekEndDay(DEFAULT_WEEK_START_DAY)).toBe(0);
  });

  it("水曜始まりの場合の週終了曜日は火曜日", () => {
    expect(getWeekEndDay(3)).toBe(2);
  });
});

describe("calculateWeekStartDate", () => {
  it("月曜日は自分自身を返す", () => {
    expect(calculateWeekStartDate("2024-01-08")).toBe("2024-01-08");
  });

  it("日曜日は前の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-14")).toBe("2024-01-08");
  });

  it("水曜日はその週の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-10")).toBe("2024-01-08");
  });

  it("土曜日はその週の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-13")).toBe("2024-01-08");
  });

  it("月をまたぐ日付でも正しく計算する", () => {
    expect(calculateWeekStartDate("2024-02-01")).toBe("2024-01-29");
  });

  it("指定した曜日を週の始まりとして計算する", () => {
    expect(calculateWeekStartDate("2024-01-10", 3)).toBe("2024-01-10");
    expect(calculateWeekStartDate("2024-01-14", 3)).toBe("2024-01-10");
  });
});

describe("calculateWeekEndDate", () => {
  it("月曜日から日曜日を正しく計算する", () => {
    expect(calculateWeekEndDate("2024-01-08")).toBe("2024-01-14");
  });

  it("月をまたぐ週終了日を正しく計算する", () => {
    expect(calculateWeekEndDate("2024-01-29")).toBe("2024-02-04");
  });
});

describe("calculateRelativeWeekStartDate", () => {
  it("前週の週開始日を返す", () => {
    expect(calculateRelativeWeekStartDate("2024-01-08", -1)).toBe("2024-01-01");
  });

  it("月をまたぐ次週の週開始日を返す", () => {
    expect(calculateRelativeWeekStartDate("2024-01-29", 1)).toBe("2024-02-05");
  });
});

describe("isValidIsoDateString", () => {
  it("実在する YYYY-MM-DD を受け入れる", () => {
    expect(isValidIsoDateString("2026-06-21")).toBe(true);
  });

  it("空文字や不正形式を拒否する", () => {
    expect(isValidIsoDateString("")).toBe(false);
    expect(isValidIsoDateString("2026/06/21")).toBe(false);
    expect(isValidIsoDateString("2026-02-30")).toBe(false);
  });
});

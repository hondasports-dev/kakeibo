import { describe, expect, it } from "vitest";
import {
  calculateWeekStartDate,
  calculateWeekEndDate,
  calculateRelativeWeekStartDate,
} from "./utils";

describe("calculateWeekStartDate", () => {
  // 月曜日 → その日
  it("月曜日は自分自身を返す", () => {
    expect(calculateWeekStartDate("2024-01-08")).toBe("2024-01-08");
  });
  // 日曜日 → 前の月曜日
  it("日曜日は前の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-14")).toBe("2024-01-08");
  });
  // 水曜日 → その週の月曜日
  it("水曜日はその週の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-10")).toBe("2024-01-08");
  });
  // 土曜日 → その週の月曜日
  it("土曜日はその週の月曜日を返す", () => {
    expect(calculateWeekStartDate("2024-01-13")).toBe("2024-01-08");
  });
  // 月末をまたぐ場合
  it("月をまたぐ日付でも正しく計算する", () => {
    expect(calculateWeekStartDate("2024-02-01")).toBe("2024-01-29");
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

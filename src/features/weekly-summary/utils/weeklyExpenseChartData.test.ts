import { describe, expect, it } from "vitest";
import {
  buildWeeklyExpenseChartData,
  formatWeeklyExpenseTooltip,
} from "./weeklyExpenseChartData";

const fourWeeks = [
  { weekStartDate: "2026-05-25", totalAmountYen: 8_000 },
  { weekStartDate: "2026-06-01", totalAmountYen: 10_000 },
  { weekStartDate: "2026-06-08", totalAmountYen: 12_000 },
  { weekStartDate: "2026-06-15", totalAmountYen: 15_000 },
];

describe("buildWeeklyExpenseChartData", () => {
  it("現在週を含む新しい3週間に週ラベルと比較値を付ける", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    });

    expect(result.map((item) => item.label)).toEqual(["2週前", "先週", "今週"]);
    expect(result[2]).toMatchObject({
      amount: 15_000,
      previousDiff: 3_000,
      averageDiff: 4_000,
      averageRate: 36,
    });
  });

  it("過去週では現在週と誤認させない日付ラベルを使う", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-22",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    });

    expect(result.map((item) => item.label)).toEqual(["6/1週", "6/8週", "6/15週"]);
  });

  it("比較元の平均が0円なら平均差と平均比を計算しない", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: [
        { weekStartDate: "2026-05-25", totalAmountYen: 0 },
        { weekStartDate: "2026-06-01", totalAmountYen: 0 },
        { weekStartDate: "2026-06-08", totalAmountYen: 0 },
        { weekStartDate: "2026-06-15", totalAmountYen: 5_000 },
      ],
    });

    expect(result[2]).toMatchObject({
      previousDiff: 5_000,
      averageDiff: null,
      averageRate: null,
    });
  });

  it("4週未満でも取得できた週だけを古い順に返す", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks.slice(2),
    });

    expect(result.map((item) => item.weekStartDate)).toEqual(["2026-06-08", "2026-06-15"]);
    expect(result[0].previousDiff).toBeNull();
  });
});

describe("formatWeeklyExpenseTooltip", () => {
  it("週範囲、合計、前週差、平均との差を日本円でまとめる", () => {
    const [item] = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    }).slice(-1);

    expect(formatWeeklyExpenseTooltip(item)).toBe(
      "6/15〜6/21｜支出合計 15,000円｜前週差 +3,000円｜平均との差 +4,000円",
    );
  });
});

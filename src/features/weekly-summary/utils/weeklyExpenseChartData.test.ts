import { describe, expect, it } from "vitest";
import {
  buildWeeklyExpenseChartData,
  formatWeeklyExpenseTooltip,
  OTHER_CATEGORY_ID,
  toSeriesDataKey,
} from "./weeklyExpenseChartData";

const fourWeeks = [
  {
    weekStartDate: "2026-05-25",
    totalAmountYen: 8_000,
    byCategory: [
      {
        categoryId: "cat-food",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 8_000,
      },
    ],
  },
  {
    weekStartDate: "2026-06-01",
    totalAmountYen: 10_000,
    byCategory: [
      {
        categoryId: "cat-food",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 10_000,
      },
    ],
  },
  {
    weekStartDate: "2026-06-08",
    totalAmountYen: 12_000,
    byCategory: [
      {
        categoryId: "cat-food",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 12_000,
      },
    ],
  },
  {
    weekStartDate: "2026-06-15",
    totalAmountYen: 15_000,
    byCategory: [
      {
        categoryId: "cat-food",
        categoryName: "食費",
        categoryColor: "#8B5E3C",
        totalAmountYen: 10_000,
      },
      {
        categoryId: "cat-daily",
        categoryName: "日用品",
        categoryColor: "#A6B28B",
        totalAmountYen: 5_000,
      },
    ],
  },
];

describe("buildWeeklyExpenseChartData", () => {
  it("現在週を含む新しい3週間に週ラベルと比較値を付ける", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    });

    expect(result.items.map((item) => item.label)).toEqual(["2週前", "先週", "今週"]);
    expect(result.items[2]).toMatchObject({
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

    expect(result.items.map((item) => item.label)).toEqual(["6/1週", "6/8週", "6/15週"]);
  });

  it("比較元の平均が0円なら平均差と平均比を計算しない", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: [
        { weekStartDate: "2026-05-25", totalAmountYen: 0, byCategory: [] },
        { weekStartDate: "2026-06-01", totalAmountYen: 0, byCategory: [] },
        { weekStartDate: "2026-06-08", totalAmountYen: 0, byCategory: [] },
        { weekStartDate: "2026-06-15", totalAmountYen: 5_000, byCategory: [] },
      ],
    });

    expect(result.items[2]).toMatchObject({
      previousDiff: 5_000,
      averageDiff: null,
      averageRate: null,
    });
  });

  it("直前2週間の平均が0.5円単位でも平均との差に小数を残さない", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: [
        { weekStartDate: "2026-05-25", totalAmountYen: 8_000, byCategory: [] },
        { weekStartDate: "2026-06-01", totalAmountYen: 10_000, byCategory: [] },
        { weekStartDate: "2026-06-08", totalAmountYen: 10_001, byCategory: [] },
        { weekStartDate: "2026-06-15", totalAmountYen: 15_000, byCategory: [] },
      ],
    });

    expect(result.items[2].averageDiff).toBe(5_000);
  });

  it("4週未満でも取得できた週だけを古い順に返す", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks.slice(2),
    });

    expect(result.items.map((item) => item.weekStartDate)).toEqual(["2026-06-08", "2026-06-15"]);
    expect(result.items[0].previousDiff).toBeNull();
  });

  it("カテゴリ別の積み上げ系列とデータセットを構築する", () => {
    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    });

    expect(result.series.map((entry) => entry.label)).toEqual(["食費", "日用品"]);
    expect(result.dataset[2]).toMatchObject({
      label: "今週",
      [toSeriesDataKey("cat-food")]: 10_000,
      [toSeriesDataKey("cat-daily")]: 5_000,
    });
  });

  it("上位5カテゴリを超える分はその他にまとめる", () => {
    const categories = Array.from({ length: 6 }, (_, index) => ({
      categoryId: `cat-${index}`,
      categoryName: `カテゴリ${index}`,
      categoryColor: "#111111",
      totalAmountYen: 1_000 * (6 - index),
    }));

    const result = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: [
        {
          weekStartDate: "2026-06-15",
          totalAmountYen: 21_000,
          byCategory: categories,
        },
      ],
    });

    expect(result.series).toHaveLength(6);
    expect(result.series.at(-1)).toMatchObject({
      dataKey: toSeriesDataKey(OTHER_CATEGORY_ID),
      label: "その他",
    });
    expect(result.dataset[0][toSeriesDataKey(OTHER_CATEGORY_ID)]).toBe(1_000);
  });
});

describe("formatWeeklyExpenseTooltip", () => {
  it("週範囲と支出合計、カテゴリ内訳をまとめる", () => {
    const { items } = buildWeeklyExpenseChartData({
      currentWeekStartDate: "2026-06-15",
      targetWeekStartDate: "2026-06-15",
      weeks: fourWeeks,
    });
    const item = items.at(-1)!;

    expect(formatWeeklyExpenseTooltip(item)).toBe(
      "6/15〜6/21｜支出合計 15,000円｜食費 10,000円 / 日用品 5,000円",
    );
  });
});

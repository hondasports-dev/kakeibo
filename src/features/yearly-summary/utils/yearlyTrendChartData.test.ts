import { describe, expect, it } from "vitest";
import { summarizeYearlyTrend } from "../../../../lib/domain/receipt/yearlySummary";
import {
  MAX_STACKED_CATEGORIES,
  OTHER_SERIES_DATA_KEY,
  buildYearlyLineSeries,
  buildYearlyTrendChartData,
  formatYearlyBalanceSeriesValue,
  formatYearlyBalanceTooltip,
  toSeriesDataKey,
} from "./yearlyTrendChartData";

function buildSummary() {
  const months = Array.from({ length: 7 }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, "0")}`,
    expenses: [
      { amountYen: 1000 + index, categoryId: `cat-${index}` },
      ...(index === 0 ? [{ amountYen: 5000, categoryId: "food" }] : []),
    ],
    incomes: [{ amountYen: 10000 }],
  }));

  const categoryInfoMap = new Map([
    ["food", { name: "食費", color: "#8B5E3C" }],
    ...months.map((_, index) => [
      `cat-${index}`,
      { name: `カテゴリ${index}`, color: `#00000${index}` },
    ]),
  ] as Array<[string, { name: string; color: string }]>);

  return summarizeYearlyTrend({
    year: "2026",
    months,
    categoryInfoMap,
  });
}

describe("buildYearlyTrendChartData", () => {
  it("月ごとの収支系列と上位カテゴリの積み上げ系列を作る", () => {
    const chartData = buildYearlyTrendChartData(buildSummary());

    expect(chartData.labels).toHaveLength(12);
    expect(chartData.labels[0]).toBe("1月");
    expect(chartData.expense[0]).toBe(6000);
    expect(chartData.income[0]).toBe(10000);
    expect(chartData.series).toHaveLength(MAX_STACKED_CATEGORIES + 1);
    expect(chartData.series.at(-1)).toMatchObject({
      dataKey: OTHER_SERIES_DATA_KEY,
      label: "その他",
    });
    expect(chartData.dataset[0]?.[toSeriesDataKey("food")]).toBe(5000);
  });

  it("上位5件以内ならその他系列を作らない", () => {
    const chartData = buildYearlyTrendChartData(
      summarizeYearlyTrend({
        year: "2026",
        months: [
          {
            month: "2026-01",
            expenses: [
              { amountYen: 1000, categoryId: "food" },
              { amountYen: 800, categoryId: "daily" },
            ],
            incomes: [],
          },
        ],
        categoryInfoMap: new Map([
          ["food", { name: "食費", color: "#8B5E3C" }],
          ["daily", { name: "日用品", color: "#4A90A4" }],
        ]),
      }),
    );

    expect(chartData.series).toHaveLength(2);
    expect(chartData.series.some((entry) => entry.label === "その他")).toBe(false);
    expect(chartData.dataset[0]?.[toSeriesDataKey("food")]).toBe(1000);
  });

  it("収支ツールチップを日本語で整形する", () => {
    expect(formatYearlyBalanceTooltip("8月", 3000, 180000)).toBe(
      "8月｜支出 3,000円｜収入 180,000円",
    );
    expect(formatYearlyBalanceSeriesValue(["8月"], [3000], [180000], 0)).toBe(
      "8月｜支出 3,000円｜収入 180,000円",
    );
    expect(formatYearlyBalanceSeriesValue([], [], [], 0)).toBe("｜支出 0円｜収入 0円");
  });

  it("収支とカテゴリの折れ線系列を組み立てる", () => {
    const chartData = buildYearlyTrendChartData(buildSummary());
    const balanceSeries = buildYearlyLineSeries("balance", chartData, {
      expense: "#f00",
      income: "#0f0",
    });
    const categorySeries = buildYearlyLineSeries("category", chartData, {
      expense: "#f00",
      income: "#0f0",
    });

    expect(balanceSeries[0]?.label).toBe("支出");
    expect(balanceSeries[0]?.valueFormatter(3000, { dataIndex: 0 })).toContain("支出");
    expect(categorySeries[0]).toMatchObject({
      area: true,
      stack: "category",
    });
  });

  it("ハイフンとアンダースコアのカテゴリIDを区別し、その他は予約キーを使う", () => {
    expect(toSeriesDataKey("a-b")).not.toBe(toSeriesDataKey("a_b"));
    expect(toSeriesDataKey("__yearly_other__")).not.toBe(OTHER_SERIES_DATA_KEY);

    const chartData = buildYearlyTrendChartData(
      summarizeYearlyTrend({
        year: "2026",
        months: [
          {
            month: "2026-01",
            expenses: [
              { amountYen: 2000, categoryId: "a_b" },
              { amountYen: 1000, categoryId: "a-b" },
              { amountYen: 100, categoryId: "c1" },
              { amountYen: 100, categoryId: "c2" },
              { amountYen: 100, categoryId: "c3" },
              { amountYen: 50, categoryId: "c4" },
            ],
            incomes: [],
          },
        ],
        categoryInfoMap: new Map([
          ["a_b", { name: "アンダースコア", color: "#111111" }],
          ["a-b", { name: "ハイフン", color: "#222222" }],
          ["c1", { name: "C1", color: "#333333" }],
          ["c2", { name: "C2", color: "#444444" }],
          ["c3", { name: "C3", color: "#555555" }],
          ["c4", { name: "C4", color: "#666666" }],
        ]),
      }),
    );

    expect(chartData.dataset[0]?.[toSeriesDataKey("a-b")]).toBe(1000);
    expect(chartData.dataset[0]?.[toSeriesDataKey("a_b")]).toBe(2000);
    expect(chartData.series.some((entry) => entry.dataKey === OTHER_SERIES_DATA_KEY)).toBe(true);
    expect(chartData.dataset[0]?.[OTHER_SERIES_DATA_KEY]).toBe(50);
  });
});

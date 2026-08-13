import { describe, expect, it } from "vitest";
import { summarizeYearlyTrend } from "../../../../lib/domain/receipt/yearlySummary";
import {
  MAX_STACKED_CATEGORIES,
  buildYearlyTrendChartData,
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
      dataKey: toSeriesDataKey("__other__"),
      label: "その他",
    });
    expect(chartData.dataset[0]?.[toSeriesDataKey("food")]).toBe(5000);
  });

  it("収支ツールチップを日本語で整形する", () => {
    expect(formatYearlyBalanceTooltip("8月", 3000, 180000)).toBe(
      "8月｜支出 3,000円｜収入 180,000円",
    );
  });
});

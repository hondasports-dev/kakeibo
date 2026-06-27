import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import { buildWeeklyExpenseChartData } from "../utils/weeklyExpenseChartData";

const chartData = buildWeeklyExpenseChartData({
  currentWeekStartDate: "2026-06-15",
  targetWeekStartDate: "2026-06-15",
  weeks: [
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
  ],
});

describe("WeeklyTrendChart", () => {
  it("対象週の要約と週別棒グラフを表示する", () => {
    renderWithProviders(<WeeklyTrendChart chartData={chartData} />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.getByText("対象週の支出")).toBeInTheDocument();
    expect(screen.getByText("15,000円")).toBeInTheDocument();
    expect(screen.getByText("+3,000円")).toBeInTheDocument();
    expect(screen.getByText("+36%")).toBeInTheDocument();
    expect(screen.getByTestId("weekly-expense-trend-chart")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
  });

  it("Y軸の金額を直感的な円・万円表記で表示する", () => {
    renderWithProviders(<WeeklyTrendChart chartData={chartData} />);

    expect(screen.queryByText(/千円$/)).not.toBeInTheDocument();
    expect(screen.getAllByText("1万円").length).toBeGreaterThan(0);
  });

  it("全週0円のとき空状態を表示する", () => {
    renderWithProviders(
      <WeeklyTrendChart
        chartData={{
          ...chartData,
          items: chartData.items.map((item) => ({ ...item, amount: 0 })),
        }}
      />,
    );

    expect(screen.getByTestId("weekly-expense-trend-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("weekly-expense-trend-chart")).not.toBeInTheDocument();
  });

  it("isLoadingがtrueのとき見出しとSkeletonを表示する", () => {
    renderWithProviders(<WeeklyTrendChart isLoading />);

    expect(screen.getByTestId("weekly-expense-trend-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("weekly-expense-trend-chart")).not.toBeInTheDocument();
  });

  it("平均を計算できないとき比較データなしと表示する", () => {
    renderWithProviders(
      <WeeklyTrendChart
        chartData={{
          ...chartData,
          items: chartData.items.map((item, index) =>
            index === chartData.items.length - 1
              ? { ...item, averageRate: null, averageDiff: null }
              : item,
          ),
        }}
      />,
    );

    expect(screen.getByText("比較データなし")).toBeInTheDocument();
  });
});

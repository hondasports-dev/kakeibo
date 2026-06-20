import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeeklyTrendChart } from "./WeeklyTrendChart";
import type { WeeklyExpenseChartItem } from "../utils/weeklyExpenseChartData";

const items: WeeklyExpenseChartItem[] = [
  {
    weekStartDate: "2026-06-01",
    weekEndDate: "2026-06-07",
    label: "2週前",
    amount: 10_000,
    previousDiff: 2_000,
    averageDiff: 2_000,
    averageRate: 25,
  },
  {
    weekStartDate: "2026-06-08",
    weekEndDate: "2026-06-14",
    label: "先週",
    amount: 12_000,
    previousDiff: 2_000,
    averageDiff: 3_000,
    averageRate: 33,
  },
  {
    weekStartDate: "2026-06-15",
    weekEndDate: "2026-06-21",
    label: "今週",
    amount: 15_000,
    previousDiff: 3_000,
    averageDiff: 4_000,
    averageRate: 36,
  },
];

describe("WeeklyTrendChart", () => {
  it("対象週の要約と週別棒グラフを表示する", () => {
    renderWithProviders(<WeeklyTrendChart items={items} />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.getByText("対象週の支出")).toBeInTheDocument();
    expect(screen.getByText("15,000円")).toBeInTheDocument();
    expect(screen.getByText("+3,000円")).toBeInTheDocument();
    expect(screen.getByText("+36%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
  });

  it("全週0円のとき空状態を表示する", () => {
    renderWithProviders(<WeeklyTrendChart items={items.map((item) => ({ ...item, amount: 0 }))} />);

    expect(screen.getByText("週別の支出データがあると表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("isLoadingがtrueのとき見出しとSkeletonを表示する", () => {
    renderWithProviders(<WeeklyTrendChart isLoading />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
    expect(screen.queryByText("週別の支出データがあると表示されます")).not.toBeInTheDocument();
  });

  it("平均を計算できないとき比較データなしと表示する", () => {
    renderWithProviders(
      <WeeklyTrendChart
        items={items.map((item, index) =>
          index === items.length - 1 ? { ...item, averageRate: null, averageDiff: null } : item,
        )}
      />,
    );

    expect(screen.getByText("比較データなし")).toBeInTheDocument();
  });
});

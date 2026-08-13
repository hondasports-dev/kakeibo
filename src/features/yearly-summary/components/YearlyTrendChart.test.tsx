import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { summarizeYearlyTrend } from "../../../../lib/domain/receipt/yearlySummary";
import { renderWithProviders } from "../../../test/render";
import { buildYearlyTrendChartData } from "../utils/yearlyTrendChartData";
import { YearlyTrendChart } from "./YearlyTrendChart";

const chartData = buildYearlyTrendChartData(
  summarizeYearlyTrend({
    year: "2026",
    months: [
      {
        month: "2026-08",
        expenses: [{ amountYen: 3000, categoryId: "food" }],
        incomes: [{ amountYen: 180000 }],
      },
    ],
    categoryInfoMap: new Map([["food", { name: "食費", color: "#8B5E3C" }]]),
  }),
);

describe("YearlyTrendChart", () => {
  it("収支の折れ線グラフを表示する", () => {
    renderWithProviders(
      <YearlyTrendChart chartData={chartData} mode="balance" onModeChange={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "月ごとの収支推移" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "月ごとの収支推移グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "収支の折れ線グラフ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("カテゴリ別の積み上げ面グラフへ切り替えられる", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    renderWithProviders(
      <YearlyTrendChart chartData={chartData} mode="balance" onModeChange={onModeChange} />,
    );

    await user.click(screen.getByRole("button", { name: "カテゴリ別の積み上げ面グラフ" }));
    expect(onModeChange).toHaveBeenCalledWith("category");
  });

  it("データが無いときは空状態を表示する", () => {
    const emptyData = buildYearlyTrendChartData(
      summarizeYearlyTrend({
        year: "2026",
        months: [],
        categoryInfoMap: new Map(),
      }),
    );

    renderWithProviders(
      <YearlyTrendChart chartData={emptyData} mode="balance" onModeChange={vi.fn()} />,
    );

    expect(screen.getByTestId("yearly-trend-chart-empty")).toHaveTextContent(
      "月ごとの収支データがあると表示されます",
    );
  });

  it("読み込み中はスケルトンを表示する", () => {
    renderWithProviders(<YearlyTrendChart isLoading mode="balance" onModeChange={vi.fn()} />);

    expect(screen.getByTestId("yearly-trend-chart-loading")).toBeInTheDocument();
  });
});

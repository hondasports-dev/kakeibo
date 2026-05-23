import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { WeeklyTrendChart } from "./WeeklyTrendChart";

const baseWeeks = [
  { weekStartDate: "2024-01-08", totalAmountYen: 3000 },
  { weekStartDate: "2024-01-15", totalAmountYen: 5000 },
  { weekStartDate: "2024-01-22", totalAmountYen: 2000 },
  { weekStartDate: "2024-01-29", totalAmountYen: 8000 },
];

describe("WeeklyTrendChart", () => {
  it("weekCount が 2 以上のとき SVG グラフが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} weekCount={4} />);

    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    // ヘッダーが表示される
    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("各バーに金額ラベルが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} weekCount={4} />);

    expect(screen.getByText("3,000円")).toBeInTheDocument();
    expect(screen.getByText("5,000円")).toBeInTheDocument();
    expect(screen.getByText("2,000円")).toBeInTheDocument();
    expect(screen.getByText("8,000円")).toBeInTheDocument();
  });

  it("各バーに週開始日のX軸ラベルが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} weekCount={4} />);

    // 月/日 形式で表示される（例: 1/8〜, 1/15〜）
    expect(screen.getByText("1/8〜")).toBeInTheDocument();
    expect(screen.getByText("1/15〜")).toBeInTheDocument();
    expect(screen.getByText("1/22〜")).toBeInTheDocument();
    expect(screen.getByText("1/29〜")).toBeInTheDocument();
  });

  it("weekCount が 1 以下のときプレースホルダーテキストが表示される", () => {
    renderWithProviders(
      <WeeklyTrendChart
        weeks={[{ weekStartDate: "2024-01-08", totalAmountYen: 1000 }]}
        weekCount={1}
      />,
    );

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("weekCount が 0 のときプレースホルダーテキストが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={[]} weekCount={0} />);

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
  });

  it("isLoading が true のとき週別支出推移 heading と Skeleton が表示される", () => {
    renderWithProviders(<WeeklyTrendChart isLoading />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
    expect(screen.queryByText("2週以上のデータが揃うとグラフが表示されます")).not.toBeInTheDocument();
  });

  it("金額が0円の週でもグラフが表示される（0円バーとして）", () => {
    const weeksWithZero = [
      { weekStartDate: "2024-01-01", totalAmountYen: 0 },
      { weekStartDate: "2024-01-08", totalAmountYen: 5000 },
      { weekStartDate: "2024-01-15", totalAmountYen: 3000 },
      { weekStartDate: "2024-01-22", totalAmountYen: 2000 },
    ];
    renderWithProviders(<WeeklyTrendChart weeks={weeksWithZero} weekCount={3} />);

    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    expect(screen.getByText("0円")).toBeInTheDocument();
  });
});

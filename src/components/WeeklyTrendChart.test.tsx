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
  it("支出がある週が2週以上あるとき SVG グラフが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} />);

    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    // ヘッダーが表示される
    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("各バーに金額ラベルが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} />);

    expect(screen.getByText("3,000円")).toBeInTheDocument();
    expect(screen.getByText("5,000円")).toBeInTheDocument();
    expect(screen.getByText("2,000円")).toBeInTheDocument();
    expect(screen.getByText("8,000円")).toBeInTheDocument();
  });

  it("各バーに週開始日のX軸ラベルが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} />);

    // 月/日 形式で表示される（例: 1/8〜, 1/15〜）
    expect(screen.getByText("1/8〜")).toBeInTheDocument();
    expect(screen.getByText("1/15〜")).toBeInTheDocument();
    expect(screen.getByText("1/22〜")).toBeInTheDocument();
    expect(screen.getByText("1/29〜")).toBeInTheDocument();
  });

  it("支出がある週が1週以下のときプレースホルダーテキストが表示される", () => {
    renderWithProviders(
      <WeeklyTrendChart weeks={[{ weekStartDate: "2024-01-08", totalAmountYen: 1000 }]} />,
    );

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("支出がある週が0のときプレースホルダーテキストが表示される", () => {
    renderWithProviders(<WeeklyTrendChart weeks={[]} />);

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
  });

  it("0円の週を支出がある週として数えない", () => {
    const weeksWithOnePaidWeek = [
      { weekStartDate: "2024-01-01", totalAmountYen: 0 },
      { weekStartDate: "2024-01-08", totalAmountYen: 5000 },
      { weekStartDate: "2024-01-15", totalAmountYen: 0 },
      { weekStartDate: "2024-01-22", totalAmountYen: 0 },
    ];

    renderWithProviders(<WeeklyTrendChart weeks={weeksWithOnePaidWeek} />);

    expect(screen.getByText("2週以上のデータが揃うとグラフが表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("isLoading が true のとき週別支出推移 heading と Skeleton が表示される", () => {
    renderWithProviders(<WeeklyTrendChart isLoading />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("2週以上のデータが揃うとグラフが表示されます"),
    ).not.toBeInTheDocument();
  });

  it("金額が0円の週でもグラフが表示される（0円バーとして）", () => {
    const weeksWithZero = [
      { weekStartDate: "2024-01-01", totalAmountYen: 0 },
      { weekStartDate: "2024-01-08", totalAmountYen: 5000 },
      { weekStartDate: "2024-01-15", totalAmountYen: 3000 },
      { weekStartDate: "2024-01-22", totalAmountYen: 2000 },
    ];
    renderWithProviders(<WeeklyTrendChart weeks={weeksWithZero} />);

    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    expect(screen.getByText("0円")).toBeInTheDocument();
  });

  it("SVG がレスポンシブ対応: viewBox が設定され width が 100% である", () => {
    renderWithProviders(<WeeklyTrendChart weeks={baseWeeks} />);

    const svg = screen.getByRole("img", { name: "週別支出推移グラフ" });
    expect(svg).toHaveAttribute("viewBox");
    expect(svg).toHaveAttribute("width", "100%");
    expect(svg).toHaveAttribute("height", "auto");
  });
});

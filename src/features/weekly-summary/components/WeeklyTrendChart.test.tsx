import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeeklyTrendChart } from "./WeeklyTrendChart";

const baseCurrentWeek = [
  { date: "2024-01-08", totalAmountYen: 1000 },
  { date: "2024-01-09", totalAmountYen: 2000 },
  { date: "2024-01-10", totalAmountYen: 0 },
  { date: "2024-01-11", totalAmountYen: 500 },
  { date: "2024-01-12", totalAmountYen: 0 },
  { date: "2024-01-13", totalAmountYen: 3000 },
  { date: "2024-01-14", totalAmountYen: 0 },
];

const basePreviousWeek = [
  { date: "2024-01-01", totalAmountYen: 500 },
  { date: "2024-01-02", totalAmountYen: 1500 },
  { date: "2024-01-03", totalAmountYen: 0 },
  { date: "2024-01-04", totalAmountYen: 2000 },
  { date: "2024-01-05", totalAmountYen: 0 },
  { date: "2024-01-06", totalAmountYen: 1000 },
  { date: "2024-01-07", totalAmountYen: 0 },
];

describe("WeeklyTrendChart", () => {
  it("今週または前週にデータがあるとき SVG グラフが表示される", () => {
    renderWithProviders(
      <WeeklyTrendChart currentWeek={baseCurrentWeek} previousWeek={basePreviousWeek} />,
    );

    expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
  });

  it("今週も前週もデータがないときプレースホルダーテキストが表示される", () => {
    renderWithProviders(<WeeklyTrendChart currentWeek={[]} previousWeek={[]} />);

    expect(screen.getByText("今週または前週の支出データがあると表示されます")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
  });

  it("isLoading が true のとき heading と Skeleton が表示される", () => {
    renderWithProviders(<WeeklyTrendChart isLoading />);

    expect(screen.getByRole("heading", { name: "週別支出推移" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "週別支出推移グラフ" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("今週または前週の支出データがあると表示されます"),
    ).not.toBeInTheDocument();
  });

  it("SVG がレスポンシブ対応: viewBox が設定され width が 100% である", () => {
    renderWithProviders(
      <WeeklyTrendChart currentWeek={baseCurrentWeek} previousWeek={basePreviousWeek} />,
    );

    const svg = screen.getByRole("img", { name: "週別支出推移グラフ" });
    expect(svg).toHaveAttribute("viewBox");
    expect(svg).toHaveAttribute("width", "100%");
    expect(svg).toHaveAttribute("height", "auto");
  });

  it("データポイントをクリックすると onPointClick が呼ばれる", async () => {
    const handleClick = vi.fn();
    const { container } = renderWithProviders(
      <WeeklyTrendChart
        currentWeek={baseCurrentWeek}
        previousWeek={basePreviousWeek}
        onPointClick={handleClick}
      />,
    );

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
    await userEvent.click(circles[0]);
    expect(handleClick).toHaveBeenCalledWith("2024-01-08");
  });
});

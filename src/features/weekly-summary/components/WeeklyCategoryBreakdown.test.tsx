import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { WeeklyCategoryBreakdown } from "./WeeklyCategoryBreakdown";

describe("WeeklyCategoryBreakdown", () => {
  it("カテゴリごとの金額・割合・件数と合計行を表示する", () => {
    renderWithProviders(
      <WeeklyCategoryBreakdown
        byCategory={[
          {
            categoryId: "food",
            categoryName: "食費",
            categoryColor: "#f97316",
            totalAmountYen: 7_500,
            count: 3,
          },
          {
            categoryId: "daily",
            categoryName: "日用品",
            categoryColor: "#84a96b",
            totalAmountYen: 2_500,
            count: 1,
          },
        ]}
        count={4}
        isLoading={false}
        totalAmountYen={10_000}
      />,
    );

    expect(screen.getByRole("heading", { name: "カテゴリ別" })).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("4件")).toBeInTheDocument();
    expect(screen.getByTestId("weekly-category-breakdown")).toHaveClass("weekly-category-panel");
  });

  it("0件では空状態を表示する", () => {
    renderWithProviders(
      <WeeklyCategoryBreakdown byCategory={[]} count={0} isLoading={false} totalAmountYen={0} />,
    );

    expect(screen.getByText("まだ支出がありません")).toBeInTheDocument();
  });
});

import type { ComponentProps } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { DashboardSummaryRow } from "./DashboardSummaryRow";

function renderSummaryRow(props: ComponentProps<typeof DashboardSummaryRow>) {
  return renderWithProviders(
    <MemoryRouter>
      <DashboardSummaryRow {...props} />
    </MemoryRouter>,
  );
}

describe("DashboardSummaryRow", () => {
  it("今週の支出・入力済み・前週比を表示する", () => {
    renderSummaryRow({
      count: 12,
      currentTotalAmountYen: 38420,
      totalIncomeYen: 300000,
      isLoading: false,
      prevWeekTotalAmountYen: 41760,
      weekEndDate: "2026-06-21",
      weekStartDate: "2026-06-15",
    });

    expect(screen.getByText("今週の支出")).toBeInTheDocument();
    expect(screen.getByText("今週の収入")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "38,420円"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "300,000円"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "12 件"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("前週比")).toHaveTextContent("92% ↓");
  });

  it("前週データがない場合は前週データなしを表示する", () => {
    renderSummaryRow({
      count: 0,
      currentTotalAmountYen: 0,
      totalIncomeYen: 0,
      isLoading: false,
      prevWeekTotalAmountYen: null,
      weekEndDate: "2026-06-21",
      weekStartDate: "2026-06-15",
    });

    expect(screen.getByLabelText("前週比")).toHaveTextContent("前週データなし");
  });
});

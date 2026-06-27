import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { DashboardSummaryRow } from "./DashboardSummaryRow";

describe("DashboardSummaryRow", () => {
  it("今週の支出・入力済み・前週比を表示する", () => {
    renderWithProviders(
      <DashboardSummaryRow
        count={12}
        currentTotalAmountYen={38420}
        isLoading={false}
        prevWeekTotalAmountYen={41760}
      />,
    );

    expect(screen.getByText("今週の支出")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "38,420円"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.getAttribute("data-value") === "12件"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("前週比")).toHaveTextContent("-8%");
  });

  it("前週データがない場合は前週データなしを表示する", () => {
    renderWithProviders(
      <DashboardSummaryRow
        count={0}
        currentTotalAmountYen={0}
        isLoading={false}
        prevWeekTotalAmountYen={null}
      />,
    );

    expect(screen.getByLabelText("前週比")).toHaveTextContent("前週データなし");
  });
});

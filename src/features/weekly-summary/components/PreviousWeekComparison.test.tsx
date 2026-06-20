import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { PreviousWeekComparison } from "./PreviousWeekComparison";

describe("PreviousWeekComparison", () => {
  it("前週データがない場合は前週データなしを表示する", () => {
    renderWithProviders(
      <PreviousWeekComparison currentTotalAmountYen={0} prevWeekTotalAmountYen={null} />,
    );

    expect(screen.getByLabelText("前週比")).toHaveTextContent("前週データなし");
  });

  it("前週合計との差額を表示する", () => {
    renderWithProviders(
      <PreviousWeekComparison currentTotalAmountYen={6280} prevWeekTotalAmountYen={7000} />,
    );

    expect(screen.getByLabelText("前週比")).toHaveTextContent("-720円");
    expect(screen.getByLabelText("前週比")).not.toHaveTextContent("前週 7,000円");
  });

  it("同額の場合は±0円を表示する", () => {
    renderWithProviders(
      <PreviousWeekComparison currentTotalAmountYen={3000} prevWeekTotalAmountYen={3000} />,
    );

    expect(screen.getByLabelText("前週比")).toHaveTextContent("±0円");
  });
});

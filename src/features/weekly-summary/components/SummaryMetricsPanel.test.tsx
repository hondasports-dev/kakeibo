import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SummaryMetricsPanel } from "./SummaryMetricsPanel";

describe("SummaryMetricsPanel", () => {
  it("合計支出・前週差・2週平均比を表示する", () => {
    renderWithProviders(
      <SummaryMetricsPanel totalAmountYen={38_420} previousDiff={-3_340} averageRate={-5} />,
    );

    expect(screen.getByText("合計支出")).toBeInTheDocument();
    expect(screen.getByText("38,420円")).toBeInTheDocument();
    expect(screen.getByText("−3,340円")).toBeInTheDocument();
    expect(screen.getByText("−5%")).toBeInTheDocument();
  });

  it("比較できない指標は比較データなしと表示する", () => {
    renderWithProviders(
      <SummaryMetricsPanel totalAmountYen={0} previousDiff={null} averageRate={null} />,
    );

    expect(screen.getAllByText("比較データなし")).toHaveLength(2);
  });
});

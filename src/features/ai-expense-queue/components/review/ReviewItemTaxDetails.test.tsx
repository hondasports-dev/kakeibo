import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewItemTaxDetails } from "./ReviewItemTaxDetails";

describe("ReviewItemTaxDetails", () => {
  it("印字額・金額基準・税率・按分税・数量単価を表示する", () => {
    render(
      <ReviewItemTaxDetails
        item={{
          id: "item-1",
          itemName: "たまご",
          amountYen: "322",
          categoryId: "cat-food",
          printedAmountYen: 298,
          amountBasis: "tax_excluded",
          taxRatePercent: 8,
          allocatedTaxYen: 24,
          quantity: 2,
          unitPriceYen: 149,
        }}
      />,
    );

    expect(screen.getByText("印字額 298円")).toBeInTheDocument();
    expect(screen.getByText("税抜印字")).toBeInTheDocument();
    expect(screen.getByText("税率 8%")).toBeInTheDocument();
    expect(screen.getByText("按分税 24円")).toBeInTheDocument();
    expect(screen.getByText("2点 × 149円")).toBeInTheDocument();
  });
});

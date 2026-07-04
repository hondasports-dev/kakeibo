import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewItemsReadOnly } from "./ReviewItemsReadOnly";

describe("ReviewItemsReadOnly", () => {
  it("登録額を主表示し、印字額・税率・按分税・warningを詳細表示する", () => {
    render(
      <ReviewItemsReadOnly
        categories={[{ _id: "cat-food", name: "食費", color: "#000000" }]}
        reviewItems={[
          {
            id: "item-1",
            itemName: "たまご",
            amountYen: "322",
            categoryId: "cat-food",
            printedAmountYen: 298,
            amountBasis: "tax_excluded",
            taxRatePercent: 8,
            allocatedTaxYen: 24,
            warnings: ["税額を確認してください"],
          },
        ]}
      />,
    );

    expect(screen.getByText("322円")).toBeInTheDocument();
    expect(screen.getByText("印字額 298円")).toBeInTheDocument();
    expect(screen.getByText("税率 8%")).toBeInTheDocument();
    expect(screen.getByText("按分税 24円")).toBeInTheDocument();
    expect(screen.getByText("税額を確認してください")).toBeInTheDocument();
  });
});

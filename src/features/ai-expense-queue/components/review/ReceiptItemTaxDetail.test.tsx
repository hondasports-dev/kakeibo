import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptItemTaxDetail } from "./ReceiptItemTaxDetail";

describe("ReceiptItemTaxDetail", () => {
  it("shows printed and normalized amounts separately", () => {
    render(
      <ReceiptItemTaxDetail
        draft={{
          markerDefinitions: [{ marker: "*", description: "軽減税率8%対象" }],
        }}
        item={{
          id: "1",
          itemName: "超熟",
          amountYen: "214",
          categoryId: "cat",
          printedAmountYen: 198,
          normalizedAmountYen: 214,
          allocatedTaxYen: 16,
          markers: ["*"],
          taxResolutionStatus: "resolved",
          taxResolutionSource: "summary_reconciliation",
          taxRatePercent: 8,
          amountBasis: "tax_excluded",
        }}
      />,
    );

    expect(screen.getByText("印字金額 198円")).toBeInTheDocument();
    expect(screen.getByText("登録金額 214円")).toBeInTheDocument();
    expect(screen.getByText("按分税 16円")).toBeInTheDocument();
    expect(screen.getByText("レシート記号 *")).toBeInTheDocument();
    expect(screen.getByText("レシート内の説明: 軽減税率8%対象")).toBeInTheDocument();
    expect(screen.getByText("税率別対象額との金額整合から判定しました")).toBeInTheDocument();
  });
});

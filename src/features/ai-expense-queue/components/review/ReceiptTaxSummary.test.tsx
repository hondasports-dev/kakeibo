import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptTaxSummary } from "./ReceiptTaxSummary";

describe("ReceiptTaxSummary", () => {
  it("renders mixed tax summaries", () => {
    render(
      <ReceiptTaxSummary
        draft={{
          _id: "draft-1",
          status: "needs_review",
          documentType: "receipt",
          reviewReasons: [],
          taxSummaries: [
            {
              taxRatePercent: 8,
              taxMode: "external",
              taxableAmountYen: 139,
              taxableAmountBasis: "tax_excluded",
              taxYen: 11,
              roundingMethod: "floor",
              warnings: [],
            },
            {
              taxRatePercent: 10,
              taxMode: "included",
              taxableAmountYen: 2050,
              taxableAmountBasis: "tax_included",
              taxYen: 186,
              roundingMethod: "unknown",
              warnings: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText("税率別集計")).toBeInTheDocument();
    expect(screen.getByText("8% 外税")).toBeInTheDocument();
    expect(screen.getByText("10% 内税")).toBeInTheDocument();
  });
});

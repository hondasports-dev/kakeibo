import { describe, expect, it } from "vitest";
import { normalizeReceiptAmounts } from "./taxNormalization";

describe("normalizeReceiptAmounts", () => {
  it("TRIAL 8%外税を按分し、印字1559円を登録1683円へ正規化する", () => {
    const result = normalizeReceiptAmounts({
      amountYen: 1683,
      items: [298, 198, 376, 78, 99, 98, 98, 118, 98, 98].map((printedAmountYen, index) => ({
        itemName: `item-${index}`,
        printedAmountYen,
        amountBasis: "tax_excluded" as const,
        taxRatePercent: 8 as const,
        taxMarker: "*",
        warnings: [],
      })),
      taxSummaries: [
        {
          taxRatePercent: 8,
          taxMode: "external",
          taxableAmountYen: 1559,
          taxableAmountBasis: "tax_excluded",
          taxYen: 124,
          taxIncludedAmountYen: 1683,
          roundingMethod: "floor",
          confidence: {},
          warnings: [],
        },
      ],
    });

    expect(result.items.reduce((sum, item) => sum + item.printedAmountYen, 0)).toBe(1559);
    expect(result.items.reduce((sum, item) => sum + item.allocatedTaxYen, 0)).toBe(124);
    expect(result.items.reduce((sum, item) => sum + item.normalizedAmountYen, 0)).toBe(1683);
    expect(result.warnings).toEqual([]);
  });

  it("8%と10%を税率別に按分する", () => {
    const result = normalizeReceiptAmounts({
      amountYen: 326,
      items: [
        {
          itemName: "food",
          printedAmountYen: 100,
          amountBasis: "tax_excluded",
          taxRatePercent: 8,
          taxMarker: "*",
          warnings: [],
        },
        {
          itemName: "goods",
          printedAmountYen: 200,
          amountBasis: "tax_excluded",
          taxRatePercent: 10,
          taxMarker: "#",
          warnings: [],
        },
      ],
      taxSummaries: [
        {
          taxRatePercent: 8,
          taxMode: "external",
          taxableAmountYen: 100,
          taxableAmountBasis: "tax_excluded",
          taxYen: 8,
          roundingMethod: "floor",
          confidence: {},
          warnings: [],
        },
        {
          taxRatePercent: 10,
          taxMode: "external",
          taxableAmountYen: 200,
          taxableAmountBasis: "tax_excluded",
          taxYen: 20,
          roundingMethod: "floor",
          confidence: {},
          warnings: [],
        },
      ],
    });
    expect(result.items.map((item) => item.allocatedTaxYen)).toEqual([8, 20]);
  });

  it("内税は印字額を登録額として維持する", () => {
    const result = normalizeReceiptAmounts({
      amountYen: 110,
      items: [
        {
          itemName: "included",
          printedAmountYen: 110,
          amountBasis: "tax_included",
          taxRatePercent: 10,
          taxMarker: "",
          warnings: [],
        },
      ],
      taxSummaries: [
        {
          taxRatePercent: 10,
          taxMode: "included",
          taxableAmountYen: 110,
          taxableAmountBasis: "tax_included",
          taxYen: 10,
          taxIncludedAmountYen: 110,
          roundingMethod: "floor",
          confidence: {},
          warnings: [],
        },
      ],
    });
    expect(result.items[0]).toMatchObject({ allocatedTaxYen: 10, normalizedAmountYen: 110 });
  });

  it("不整合・税率不明・金額基準不明をwarningにする", () => {
    const result = normalizeReceiptAmounts({
      amountYen: 999,
      items: [
        {
          itemName: "unknown",
          printedAmountYen: 100,
          amountBasis: "unknown",
          taxRatePercent: null,
          taxMarker: "",
          warnings: [],
        },
      ],
      taxSummaries: [],
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unknown_tax_rate"),
        expect.stringContaining("unknown_amount_basis"),
        expect.stringContaining("normalized_amount_mismatch"),
      ]),
    );
  });
});

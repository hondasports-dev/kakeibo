import { describe, expect, it } from "vitest";
import { deriveBulkTaxSettings, getBulkTaxSettingsErrorMessage } from "./applyReceiptTaxSettings";

const baseSummary = {
  taxRatePercent: 10 as const,
  taxMode: "external" as const,
  taxableAmountYen: 1000,
  taxableAmountBasis: "unknown" as const,
  taxYen: 100,
  roundingMethod: "unknown" as const,
  confidence: {},
  warnings: [] as string[],
};

describe("deriveBulkTaxSettings", () => {
  it("summary から taxRatePercent と amountBasis を導出する", () => {
    expect(
      deriveBulkTaxSettings({
        summary: { ...baseSummary, taxMode: "external" as const },
      }),
    ).toEqual({
      success: true,
      taxRatePercent: 10,
      amountBasis: "tax_excluded",
    });
  });

  it("taxMode included なら tax_included", () => {
    expect(
      deriveBulkTaxSettings({
        summary: {
          ...baseSummary,
          taxMode: "included" as const,
          taxableAmountBasis: "unknown" as const,
        },
      }),
    ).toEqual({
      success: true,
      taxRatePercent: 10,
      amountBasis: "tax_included",
    });
  });

  it("引数で amountBasis を上書きできる", () => {
    expect(
      deriveBulkTaxSettings({
        summary: baseSummary,
        amountBasis: "tax_included",
      }),
    ).toEqual({
      success: true,
      taxRatePercent: 10,
      amountBasis: "tax_included",
    });
  });

  it("unknown / mixed taxMode はエラー", () => {
    expect(
      deriveBulkTaxSettings({
        summary: { ...baseSummary, taxMode: "unknown" as const },
        amountBasis: "tax_included",
      }),
    ).toEqual({ success: false, error: "unknown_tax_mode" });

    expect(
      deriveBulkTaxSettings({
        summary: { ...baseSummary, taxMode: "mixed" as const },
        amountBasis: "tax_included",
      }),
    ).toEqual({ success: false, error: "unknown_tax_mode" });
  });

  it("taxableAmountBasis と taxMode から amountBasis が導出できない場合はエラー", () => {
    expect(
      deriveBulkTaxSettings({
        summary: {
          ...baseSummary,
          taxMode: "external" as const,
          taxableAmountBasis: "unknown" as const,
        },
      }),
    ).toEqual({ success: true, taxRatePercent: 10, amountBasis: "tax_excluded" });
  });
});

describe("getBulkTaxSettingsErrorMessage", () => {
  it.each([
    ["unknown_tax_mode", "Bulk tax settings require a definitive tax mode"],
    ["cannot_derive_amount_basis", "Could not derive amount basis from tax summary"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getBulkTaxSettingsErrorMessage(error)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { reconcileTaxSummary, normalizeTaxSummary } from "./taxSummaryConsistency";
import type { ExtractedTaxSummary } from "./types";

function baseSummary(overrides: Partial<ExtractedTaxSummary> = {}): ExtractedTaxSummary {
  return {
    taxRatePercent: 10,
    taxMode: "included",
    taxableAmountYen: 1060,
    taxableAmountBasis: "tax_included",
    taxYen: 96,
    taxIncludedAmountYen: 1060,
    roundingMethod: "unknown",
    confidence: {},
    warnings: [],
    ...overrides,
  };
}

describe("taxSummaryConsistency matrix", () => {
  it("included / tax_included / A = P => coherent", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({ taxableAmountYen: 1060, taxYen: 96, taxIncludedAmountYen: 1060 }),
      amountYen: 1060,
    });
    expect(result.status).toBe("coherent");
    expect(result.reasons).toEqual([]);
  });

  it("external / tax_excluded / A + T = P => coherent", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "external",
        taxableAmountYen: 964,
        taxableAmountBasis: "tax_excluded",
        taxYen: 96,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("coherent");
    expect(result.reasons).toEqual([]);
  });

  it("included / tax_excluded => conflicting", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "included",
        taxableAmountYen: 960,
        taxableAmountBasis: "tax_excluded",
        taxYen: 96,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("conflicting");
    expect(result.reasons).toContain("included_mode_with_tax_excluded_basis");
    expect(result.reasons).toContain("tax_summary_amount_mismatch");
  });

  it("external / tax_included => conflicting", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "external",
        taxableAmountYen: 1060,
        taxableAmountBasis: "tax_included",
        taxYen: 96,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("conflicting");
    expect(result.reasons).toContain("external_mode_with_tax_included_basis");
  });

  it("unknown / tax_included / A = P => reconcilable to included", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "unknown",
        taxableAmountYen: 1060,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("reconcilable");
    expect(result.reasons).toContain("reconciled_to_included");
  });

  it("unknown / tax_excluded / A + T = P => reconcilable to external", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "unknown",
        taxableAmountYen: 964,
        taxableAmountBasis: "tax_excluded",
        taxYen: 96,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("reconcilable");
    expect(result.reasons).toContain("reconciled_to_external");
  });

  it("unknown / unknown / A + T = P => reconcilable to external", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "unknown",
        taxableAmountBasis: "unknown",
        taxableAmountYen: 964,
        taxYen: 96,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("reconcilable");
    expect(result.reasons).toContain("reconciled_to_external");
  });

  it("included / tax_included / A + T = P and A != P => reconcilable to external (OCR misread)", () => {
    const result = normalizeTaxSummary(
      baseSummary({
        taxMode: "included",
        taxableAmountYen: 7928,
        taxableAmountBasis: "tax_included",
        taxYen: 634,
        taxIncludedAmountYen: 8562,
      }),
      8562,
    );
    expect(result.taxMode).toBe("external");
    expect(result.taxableAmountBasis).toBe("tax_excluded");
    expect(result.status).toBe("coherent");
  });

  it("included / tax_included / A != P and A + T != P => coherent (I undefined, trust declared mode)", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "included",
        taxableAmountYen: 900,
        taxableAmountBasis: "tax_included",
        taxYen: 96,
        taxIncludedAmountYen: undefined,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("coherent");
  });

  it("external / tax_excluded / A + T != P and I undefined => coherent (do not conflict on stale amount)", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "external",
        taxableAmountYen: 298,
        taxableAmountBasis: "tax_excluded",
        taxYen: 24,
        taxIncludedAmountYen: undefined,
      }),
      amountYen: 324,
    });
    expect(result.status).toBe("coherent");
  });

  it("I = P but A inconsistent => conflicting", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "included",
        taxableAmountYen: 960,
        taxableAmountBasis: "tax_included",
        taxYen: 96,
        taxIncludedAmountYen: 1060,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("conflicting");
    expect(result.reasons).toContain("tax_summary_amount_mismatch");
  });

  it("A = P but I inconsistent => conflicting", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "included",
        taxableAmountYen: 1060,
        taxableAmountBasis: "tax_included",
        taxYen: 96,
        taxIncludedAmountYen: 960,
      }),
      amountYen: 1060,
    });
    expect(result.status).toBe("conflicting");
    expect(result.reasons).toContain("tax_included_amount_mismatch");
  });

  it("taxYen 0 with included / A = P => coherent", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "included",
        taxableAmountYen: 1000,
        taxYen: 0,
        taxIncludedAmountYen: 1000,
      }),
      amountYen: 1000,
    });
    expect(result.status).toBe("coherent");
  });

  it("mixed tax mode => conflicting", () => {
    const result = reconcileTaxSummary({
      summary: baseSummary({
        taxMode: "mixed",
        taxableAmountYen: 1000,
        taxableAmountBasis: "tax_included",
        taxYen: 96,
        taxIncludedAmountYen: 1000,
      }),
      amountYen: 1000,
    });
    expect(result.status).toBe("conflicting");
    expect(result.reasons).toContain("mixed_tax_mode");
  });

  it("multiple summaries keep coherent with I undefined", () => {
    const base = baseSummary({
      taxableAmountYen: 100,
      taxYen: 8,
      taxIncludedAmountYen: undefined,
      taxRatePercent: 8,
    });
    const result = normalizeTaxSummary(base, undefined);
    expect(result.status).toBe("coherent");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeTaxSummaries } from "./normalizeTaxSummaries";

const summary = (
  taxableAmountYen: number,
  taxYen: number,
  taxMode: "external" | "included" = "included",
  taxableAmountBasis: "tax_included" | "tax_excluded" = "tax_included",
) => ({
  taxRatePercent: 8 as const,
  taxMode,
  taxableAmountYen,
  taxableAmountBasis,
  taxYen,
  roundingMethod: "unknown" as const,
  confidence: {},
  warnings: [] as string[],
});

describe("normalizeTaxSummaries", () => {
  it("小計+税=支払合計かつ小計≠支払合計のとき外税に補正する", () => {
    const result = normalizeTaxSummaries({
      amountYen: 8562,
      taxSummaries: [summary(7928, 634)],
    });
    expect(result[0]).toMatchObject({
      taxMode: "external",
      taxableAmountBasis: "tax_excluded",
    });
  });

  it("内税典型（対象額=支払合計）は補正しない", () => {
    const result = normalizeTaxSummaries({
      amountYen: 1060,
      taxSummaries: [summary(1060, 96)],
    });
    expect(result[0]).toMatchObject({
      taxMode: "included",
      taxableAmountBasis: "tax_included",
    });
  });

  it("複数summaryはそのまま返す", () => {
    const summaries = [summary(100, 8), summary(200, 20)];
    expect(normalizeTaxSummaries({ amountYen: 328, taxSummaries: summaries })).toEqual(
      summaries.map((s) => ({ ...s, status: "coherent", reasons: [] })),
    );
  });

  it("resolvableTaxSummaries が1件のとき、全体が複数でもその1件に amountYen を適用する", () => {
    const resolvable = summary(7928, 634, "included", "tax_included");
    const conflicting = summary(100, 8, "external", "tax_excluded");
    const result = normalizeTaxSummaries({
      amountYen: 8562,
      taxSummaries: [conflicting, resolvable],
      resolvableTaxSummaries: [resolvable],
    });
    const normalizedResolvable = result.find((s) => s.taxableAmountYen === 7928);
    expect(normalizedResolvable).toMatchObject({
      taxMode: "external",
      taxableAmountBasis: "tax_excluded",
      status: "coherent",
    });
  });
});

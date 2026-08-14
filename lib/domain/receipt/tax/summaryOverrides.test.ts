import { describe, expect, it } from "vitest";
import { buildDraftSummaryOverride } from "./summaryOverrides";

describe("buildDraftSummaryOverride", () => {
  it("指定フィールドから summary override を構築する", () => {
    const result = buildDraftSummaryOverride({
      index: 0,
      taxRatePercent: 10,
      taxableAmountYen: 1000,
      taxYen: 100,
    });
    expect(result).toEqual({
      index: 0,
      summary: {
        taxRatePercent: 10,
        taxableAmountYen: 1000,
        taxYen: 100,
      },
    });
  });

  it("負の数値を拒否する", () => {
    expect(() => buildDraftSummaryOverride({ index: 0, taxableAmountYen: -1 })).toThrow(
      "taxableAmountYen must be a finite non-negative number",
    );
  });

  it("NaN を拒否する", () => {
    expect(() => buildDraftSummaryOverride({ index: 0, taxYen: NaN })).toThrow(
      "taxYen must be a finite non-negative number",
    );
  });

  it("Infinity を拒否する", () => {
    expect(() => buildDraftSummaryOverride({ index: 0, taxIncludedAmountYen: Infinity })).toThrow(
      "taxIncludedAmountYen must be a finite non-negative number",
    );
  });

  it("少なくとも1つのフィールドが必要", () => {
    expect(() => buildDraftSummaryOverride({ index: 0 })).toThrow(
      "At least one tax override field must be provided",
    );
  });
});

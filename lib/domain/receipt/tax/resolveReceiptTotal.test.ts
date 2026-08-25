import { describe, expect, it } from "vitest";
import { resolveReceiptTotal } from "./resolveReceiptTotal";
import type { ExtractedTaxSummary } from "./types";

function summary(overrides: Partial<ExtractedTaxSummary> = {}): ExtractedTaxSummary {
  return {
    taxRatePercent: 8,
    taxMode: "external",
    taxableAmountYen: 743,
    taxableAmountBasis: "tax_excluded",
    taxYen: 60,
    taxIncludedAmountYen: 803,
    roundingMethod: "unknown",
    confidence: {},
    warnings: [],
    ...overrides,
  };
}

describe("resolveReceiptTotal", () => {
  it("7,803円の明示合計を743円+60円の算術候補で置換しない", () => {
    const result = resolveReceiptTotal({
      amountYen: 7803,
      source: "explicit_label",
      confidence: 0.99,
      taxSummaries: [summary()],
    });

    expect(result.status).toBe("ambiguous");
    expect(result.protectedAmountYen).toBe(7803);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountYen: 7803, source: "explicit_label" }),
        expect.objectContaining({ amountYen: 803, source: "tax_arithmetic" }),
      ]),
    );
  });

  it("ユーザー確認済み合計は矛盾する税候補より優先する", () => {
    const result = resolveReceiptTotal({
      amountYen: 7803,
      source: "user_confirmed",
      taxSummaries: [summary()],
    });

    expect(result.status).toBe("verified");
    expect(result.protectedAmountYen).toBe(7803);
    expect(result.reasons).toContain("user_confirmed_total_precedes_tax_candidates");
  });

  it("複数税率の部分対象額を支払総額候補として単純合算しない", () => {
    const result = resolveReceiptTotal({
      amountYen: 1080,
      source: "explicit_label",
      confidence: 0.99,
      taxSummaries: [
        summary({ taxRatePercent: 8, taxableAmountYen: 540, taxYen: 40 }),
        summary({ taxRatePercent: 10, taxableAmountYen: 500, taxYen: 50 }),
      ],
    });

    expect(result.status).toBe("verified");
    expect(result.candidates).toEqual([
      expect.objectContaining({ amountYen: 1080, source: "explicit_label" }),
    ]);
  });

  it("出所不明のAI合計は税候補と一致しても確認待ちにする", () => {
    const result = resolveReceiptTotal({ amountYen: 803, taxSummaries: [summary()] });

    expect(result.status).toBe("ambiguous");
    expect(result.candidates[0]).toMatchObject({ amountYen: 803, source: "ai_estimate" });
    expect(result.reasons).toContain("receipt_total_source_unverified");
  });

  it("明示ラベルでも低信頼度なら確認待ちにする", () => {
    const result = resolveReceiptTotal({
      amountYen: 803,
      source: "explicit_label",
      confidence: 0.4,
      taxSummaries: [summary()],
    });

    expect(result.status).toBe("ambiguous");
    expect(result.reasons).toContain("receipt_total_low_confidence");
  });

  it("預り金と釣銭から得た支払候補は根拠付きで保持し、現金額や釣銭額自体は候補にしない", () => {
    const result = resolveReceiptTotal({
      amountYen: 7803,
      source: "explicit_label",
      confidence: 0.99,
      supportingCandidates: [
        {
          amountYen: 7803,
          source: "payment_change",
          evidence: "cash_received:10000 - change:2197",
        },
      ],
      taxSummaries: [],
    });

    expect(result.status).toBe("verified");
    expect(result.candidates).toContainEqual({
      amountYen: 7803,
      source: "payment_change",
      evidence: "cash_received:10000 - change:2197",
    });
    expect(result.candidates.some((candidate) => candidate.amountYen === 10000)).toBe(false);
    expect(result.candidates.some((candidate) => candidate.amountYen === 2197)).toBe(false);
  });

  it.each([0, 10_000_000, 1.5])("無効または不明な合計 %s は確認待ちにする", (amountYen) => {
    const result = resolveReceiptTotal({
      amountYen,
      source: "explicit_label",
      confidence: 0.99,
      taxSummaries: [],
    });

    expect(result.status).toBe("ambiguous");
    expect(result.protectedAmountYen).toBe(amountYen);
    expect(result.reasons).toContain("receipt_total_missing_or_invalid");
  });

  it("confidence 0.8 は明示合計として閾値内にする", () => {
    const result = resolveReceiptTotal({
      amountYen: 803,
      source: "explicit_label",
      confidence: 0.8,
      taxSummaries: [],
    });

    expect(result.status).toBe("verified");
  });
});

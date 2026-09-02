import { describe, expect, it } from "vitest";
import type { ReceiptRawObservationLine } from "../observations";
import { deriveTaxSummariesFromObservations } from "./taxSummariesFromObservations";

function line(
  sourceLineIndex: number,
  rawText: string,
  amountYen: number,
): ReceiptRawObservationLine {
  return {
    rawText,
    amountText: `${amountYen}円`,
    amountYen,
    lineRoleCandidates: ["tax"],
    roleConfidence: 0.9,
    explicitlyPrinted: true,
    sourceLineIndex,
  };
}

describe("deriveTaxSummariesFromObservations", () => {
  it("構造化税summaryが欠落しても明示内税行を復元する", () => {
    expect(
      deriveTaxSummariesFromObservations([
        line(1, "(10%内税 対象) 530円", 530),
        line(2, "(10%内税額) 48円", 48),
      ]),
    ).toEqual([
      expect.objectContaining({
        taxRatePercent: 10,
        taxMode: "included",
        taxableAmountYen: 530,
        taxableAmountBasis: "tax_included",
        taxYen: 48,
        taxIncludedAmountYen: 530,
      }),
    ]);
  });

  it("片方しかない税行は推測で復元しない", () => {
    expect(deriveTaxSummariesFromObservations([line(1, "8%外税 16円", 16)])).toEqual([]);
  });

  it("同じ税率に矛盾する複数の明示行がある場合は復元しない", () => {
    expect(
      deriveTaxSummariesFromObservations([
        line(1, "(10%内税 対象) 530円", 530),
        line(2, "(10%内税 対象) 1060円", 1060),
        line(3, "(10%内税額) 48円", 48),
      ]),
    ).toEqual([]);
  });
});

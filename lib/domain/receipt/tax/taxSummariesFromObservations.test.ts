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
  it("unlabelled external target remains net when tax arithmetic supports it", () => {
    expect(
      deriveTaxSummariesFromObservations(
        [line(1, "8%対象 1000円", 1000), line(2, "外税8% 80円", 80)],
        1080,
      ),
    ).toEqual([expect.objectContaining({ taxableAmountYen: 1000, taxIncludedAmountYen: 1080 })]);
  });
  it("unlabelled gross echo is distinguished from an external net target", () => {
    expect(
      deriveTaxSummariesFromObservations(
        [
          line(1, "外税8% 582円", 582),
          line(2, "税率8%対象額7860円", 7860),
          line(3, "(内)消費税等8%582円", 582),
        ],
        8716,
      ),
    ).toEqual([expect.objectContaining({ taxableAmountYen: 7278, taxIncludedAmountYen: 7860 })]);
  });
  it("ambiguous unlabelled bases and inconsistent subtotals stay unresolved", () => {
    expect(
      deriveTaxSummariesFromObservations([line(1, "8%対象10円", 10), line(2, "外税8%0円", 0)], 10),
    ).toEqual([]);
    expect(
      deriveTaxSummariesFromObservations(
        [line(1, "小計1000円", 1000), line(2, "外税8%80円", 80)],
        1000,
      ),
    ).toEqual([]);
  });
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

  it("0%外税対象の明示modeを上書きしない", () => {
    expect(deriveTaxSummariesFromObservations([line(1, "0%外税 対象 500円", 500)])).toEqual([
      expect.objectContaining({
        taxRatePercent: 0,
        taxMode: "external",
        taxableAmountBasis: "tax_excluded",
        taxableAmountYen: 500,
        taxYen: 0,
      }),
    ]);
  });
});

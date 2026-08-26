import { describe, expect, it } from "vitest";
import { interpretReceiptTaxDecision } from "./interpretReceiptTaxDecision";
import type { ExtractedReceiptItem, ExtractedTaxSummary, ReceiptTaxInput } from "./types";

const item = (
  amountBasis: ExtractedReceiptItem["amountBasis"] = "unknown",
  taxRatePercent: ExtractedReceiptItem["taxRatePercent"] = null,
): ExtractedReceiptItem => ({
  itemName: "商品",
  printedAmountYen: 1000,
  taxRatePercent,
  amountBasis,
  markers: [],
  warnings: [],
});

const summary = (overrides: Partial<ExtractedTaxSummary> = {}): ExtractedTaxSummary => ({
  taxRatePercent: 10,
  taxMode: "included",
  taxableAmountYen: 1100,
  taxableAmountBasis: "tax_included",
  taxYen: 100,
  roundingMethod: "unknown",
  confidence: {},
  warnings: [],
  status: "verified",
  ...overrides,
});

function line(
  rawText: string,
  amountYen: number | null,
  sourceLineIndex: number,
  role: "item" | "tax" | "fee" | "payment" = "tax",
) {
  return {
    rawText,
    amountText: amountYen === null ? null : `${amountYen}円`,
    amountYen,
    lineRoleCandidates: [role] as const,
    roleConfidence: 0.9,
    explicitlyPrinted: true,
    sourceLineIndex,
  };
}

function classification(
  sourceLineIndex: number,
  role: "tax" | "fee" | "coupon" | "pointsUsed" | "paymentMethodAmount" | "change",
  evidence: string[] = [],
) {
  return {
    sourceLineIndex,
    status: "classified" as const,
    candidates: [{ role, score: 0.95, evidence }],
  };
}

function baseInput(overrides: Partial<ReceiptTaxInput> = {}): ReceiptTaxInput {
  return {
    amountYen: 1100,
    items: [item("tax_included", 10)],
    taxSummaries: [summary()],
    ...overrides,
  };
}

describe("interpretReceiptTaxDecision decision table", () => {
  it("ユーザー補正をAI・算術より優先する", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        userOverride: { priceTaxTreatment: "perItem", taxRateComposition: "mixed" },
        items: [item("tax_excluded", 8), item("tax_included", 10)],
        taxSummaries: [summary({ roundingMethod: "round", status: "ambiguous" })],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "perItem",
      taxRateComposition: "mixed",
      resolutionStatus: "verified",
      resolutionSource: "user",
    });
  });

  it("明示ラベルで税込と10%を独立してverifiedにする", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        rawObservationLines: [line("税込 10% 消費税額 100円", 100, 8)],
        receiptLineClassifications: [classification(8, "tax", ["position:receipt_footer"])],
        taxSummaries: [summary({ status: "ambiguous" })],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "rate10",
      resolutionStatus: "verified",
      resolutionSource: "explicitLabel",
      taxAmount: { printedTaxYen: 100, source: "printed" },
    });
  });

  it("税込・税抜商品の混在をperItem、8%・10%をmixedとして別軸にする", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("tax_included", 8), item("tax_excluded", 10)],
        rawObservationLines: [
          line("税込商品 8%", 500, 1, "item"),
          line("税抜商品 10%", 500, 2, "item"),
          line("消費税額", 50, 9),
        ],
        receiptLineClassifications: [classification(9, "tax")],
        taxSummaries: [summary({ status: "ambiguous" })],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "perItem",
      taxRateComposition: "mixed",
      resolutionStatus: "verified",
    });
  });

  it("価格表示は明示ラベル、税率構成はマーカー凡例でverifiedにする", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("tax_included", 8), item("tax_included", 10)],
        rawObservationLines: [line("税込", 1100, 8), line("消費税額 100円", 100, 9)],
        receiptLineClassifications: [classification(9, "tax")],
        taxSummaries: [summary({ status: "ambiguous" })],
        markerDefinitions: [
          { marker: "*", description: "軽減税率8%" },
          { marker: "#", description: "標準税率10%" },
        ],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "mixed",
      resolutionStatus: "verified",
      resolutionSource: "marker",
    });
    expect(decision.evidence).toEqual(expect.arrayContaining(["marker_legend:rate_8"]));
  });

  it("AI抽出と算術一致だけではverifiedにしない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        amountYen: 1100,
        items: [item("unknown", null)],
        taxSummaries: [
          summary({
            taxMode: "unknown",
            taxableAmountBasis: "unknown",
            taxableAmountYen: 1000,
            taxYen: 100,
            status: "ambiguous",
          }),
        ],
      }),
    );

    expect(decision.resolutionStatus).toBe("ambiguous");
    expect(decision.reasons).toContain("insufficient_primary_evidence");
    expect(decision.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          priceTaxTreatment: "excluded",
          resolutionSource: "ai",
          resolutionStatus: "ambiguous",
        }),
      ]),
    );
  });

  it("既知basisにunknownが混ざる場合は価格扱いを確定しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("tax_included", 10), item("unknown", 10)],
        taxSummaries: [summary({ status: "ambiguous" })],
      }),
    );

    expect(decision.priceTaxTreatment).toBe("unknown");
    expect(decision.resolutionStatus).toBe("ambiguous");
  });

  it("完全照合済み集計をAI・算術より優先する", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [{ ...item("tax_included", 10), printedAmountYen: 1100 }],
        taxSummaries: [summary({ roundingMethod: "floor" })],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "rate10",
      resolutionStatus: "verified",
      resolutionSource: "reconciliation",
      taxAmount: { source: "estimated", roundingMethod: "floor" },
    });
    expect(decision.evidence).toEqual(
      expect.arrayContaining([
        "reconciliation:treatment_included",
        "reconciliation:composition_rate10",
      ]),
    );
  });

  it("免税・インボイス事業者表記だけでは税額0や非課税を確定しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("unknown", null)],
        taxSummaries: [],
        rawObservationLines: [line("適格請求書発行事業者ではない", null, 9)],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "unknown",
      taxRateComposition: "unknown",
      resolutionStatus: "ambiguous",
      taxAmount: { source: "unknown" },
    });
  });

  it("税額0だけでは税率構成を確定しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("tax_included", 0)],
        taxSummaries: [summary({ taxRatePercent: 0, taxYen: 0, status: "ambiguous" })],
        rawObservationLines: [line("税込 税額0円", 0, 9)],
        receiptLineClassifications: [classification(9, "tax")],
      }),
    );

    expect(decision.taxRateComposition).toBe("unknown");
    expect(decision.resolutionStatus).toBe("ambiguous");
  });

  it("印字税額がなければ推定税額として分離し、丸め不明ならambiguousにする", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        rawObservationLines: [line("税込 10%", 1100, 8)],
        taxSummaries: [summary({ status: "ambiguous" })],
      }),
    );

    expect(decision.taxAmount).toEqual({
      estimatedTaxYen: 100,
      roundingMethod: "unknown",
      source: "estimated",
    });
    expect(decision.resolutionStatus).toBe("ambiguous");
    expect(decision.reasons).toContain("estimated_tax_with_unknown_rounding");
  });

  it("矛盾summaryがあれば明示ラベルがあってもcontradictoryにする", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        rawObservationLines: [line("税込 10% 消費税額100円", 100, 9)],
        receiptLineClassifications: [classification(9, "tax")],
        taxSummaries: [summary({ status: "contradictory" })],
      }),
    );

    expect(decision.resolutionStatus).toBe("contradictory");
    expect(decision.reasons).toContain("contradictory_tax_summary");
  });

  it("値引き・ポイント・手数料・決済行を税証拠にせず除外根拠を残す", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        rawObservationLines: [line("税込 10% 消費税額100円", 100, 9)],
        receiptLineClassifications: [
          classification(2, "coupon"),
          classification(3, "pointsUsed"),
          classification(4, "fee"),
          classification(5, "paymentMethodAmount"),
          classification(9, "tax"),
        ],
        taxSummaries: [summary({ status: "ambiguous" })],
      }),
    );

    expect(decision.resolutionStatus).toBe("verified");
    expect(decision.reasons).toContain("non_tax_adjustment_lines_excluded");
  });

  it("決済行の税込・税率表記を税判断の証拠にしない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("unknown", null)],
        taxSummaries: [summary({ status: "ambiguous", taxableAmountBasis: "unknown" })],
        rawObservationLines: [line("カード決済 税抜 10%", 1100, 12, "payment")],
        receiptLineClassifications: undefined,
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "rate10",
      resolutionStatus: "ambiguous",
    });
    expect(decision.evidence).not.toContain("explicit_label:excluded");
    expect(decision.reasons).toContain("non_tax_adjustment_lines_excluded");
  });

  it("分類なし決済行の税額ラベルを印字税額として扱わない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("unknown", null)],
        taxSummaries: [],
        rawObservationLines: [line("カード決済 消費税額100円", 100, 12, "payment")],
        receiptLineClassifications: undefined,
      }),
    );

    expect(decision.taxAmount).toEqual({ roundingMethod: "unknown", source: "unknown" });
    expect(decision.reasons).toContain("non_tax_adjustment_lines_excluded");
  });

  it("itemとsummaryのbasis不一致をperItem商品混在にしない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [item("tax_excluded", 10)],
      }),
    );

    expect(decision.priceTaxTreatment).not.toBe("perItem");
    expect(decision.resolutionStatus).toBe("contradictory");
    expect(decision.reasons).toContain("receipt_reconciliation_mismatch");
  });

  it("税率だけのuser overrideは価格軸をuserへ昇格しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        userOverride: { taxRateComposition: "rate8" },
        items: [item("tax_excluded", 8)],
        taxSummaries: [summary({ status: "ambiguous", taxRatePercent: 8 })],
        rawObservationLines: [line("税込", 1100, 8)],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "rate8",
      resolutionSource: "explicitLabel",
    });
    expect(decision.evidence).toEqual(
      expect.arrayContaining(["explicit_label:included", "user_override:composition"]),
    );
    expect(decision.evidence).not.toContain("user_override:treatment");
  });

  it("税率別summary合計が支払総額と不一致なら全体照合済みにしない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        amountYen: 2000,
        items: [item("tax_included", 8), item("tax_included", 10)],
        taxSummaries: [
          summary({ taxRatePercent: 8, taxableAmountYen: 1000, taxYen: 74 }),
          summary({ taxRatePercent: 10, taxableAmountYen: 900, taxYen: 82 }),
        ],
      }),
    );

    expect(decision.resolutionStatus).toBe("contradictory");
    expect(decision.reasons).toContain("receipt_reconciliation_mismatch");
    expect(decision.resolutionSource).not.toBe("reconciliation");
  });

  it("summary basis不明を金額矛盾へ格上げしない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        items: [{ ...item("tax_included", 10), printedAmountYen: 1100 }],
        taxSummaries: [
          summary({
            taxMode: "unknown",
            taxableAmountBasis: "unknown",
            status: "verified",
          }),
        ],
      }),
    );

    expect(decision.resolutionStatus).toBe("ambiguous");
    expect(decision.reasons).not.toContain("receipt_reconciliation_mismatch");
  });

  it("税率別明細と税合計の併記を二重加算しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("10% 消費税額 100円", 100, 8), line("税合計 100円", 100, 9)],
        receiptLineClassifications: [classification(8, "tax"), classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount).toMatchObject({ printedTaxYen: 100, source: "printed" });
    expect(decision.reasons).not.toContain("conflicting_printed_tax_lines");
  });

  it("分類情報がなくても明示的な印字税額を認識する", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("消費税額 100円", 100, 9)],
        receiptLineClassifications: undefined,
      }),
    );

    expect(decision.taxAmount).toMatchObject({ printedTaxYen: 100, source: "printed" });
  });

  it("税率ラベルの数値を印字税額として扱わない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [],
        rawObservationLines: [line("消費税 率 10%", 10, 9)],
        receiptLineClassifications: [classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount).toEqual({ roundingMethod: "unknown", source: "unknown" });
  });

  it("税率表記つきgrand totalをrate detailへ二重所属させない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("10% 消費税額 100円", 100, 8), line("10% 税合計 100円", 100, 9)],
        receiptLineClassifications: [classification(8, "tax"), classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount).toMatchObject({ printedTaxYen: 100, source: "printed" });
    expect(decision.reasons).not.toContain("conflicting_printed_tax_lines");
    expect(decision.resolutionStatus).not.toBe("contradictory");
  });

  it("footer税行の具体的な税率文脈をposition sourceとして候補化する", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("税込", 1100, 8), line("標準税 消費税額 100円", 100, 9)],
        receiptLineClassifications: [classification(9, "tax", ["position:receipt_footer"])],
      }),
    );

    expect(decision).toMatchObject({
      priceTaxTreatment: "included",
      taxRateComposition: "rate10",
      resolutionSource: "position",
      resolutionStatus: "verified",
    });
    expect(decision.evidence).toContain("position:receipt_footer_tax_rate_context");
  });

  it("genericなfooter税行だけではAI軸をpositionへ昇格しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("消費税額 100円", 100, 9)],
        receiptLineClassifications: [classification(9, "tax", ["position:receipt_footer"])],
      }),
    );

    expect(decision.resolutionSource).toBe("ai");
    expect(decision.resolutionStatus).toBe("ambiguous");
    expect(decision.evidence).not.toContain("position:receipt_footer_tax_rate_context");
  });

  it("軽減・標準の同額税明細を区分別に合算する", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [
          line("軽減税 消費税額 80円", 80, 8),
          line("標準税 消費税額 80円", 80, 9),
        ],
        receiptLineClassifications: [classification(8, "tax"), classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount.printedTaxYen).toBe(160);
    expect(decision.reasons).not.toContain("conflicting_printed_tax_lines");
  });

  it("税率別明細合計とgrand totalの不一致を矛盾として残す", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [
          line("軽減税 消費税額 80円", 80, 8),
          line("標準税 消費税額 80円", 80, 9),
          line("税合計 100円", 100, 10),
        ],
        receiptLineClassifications: [
          classification(8, "tax"),
          classification(9, "tax"),
          classification(10, "tax"),
        ],
      }),
    );

    expect(decision.taxAmount.printedTaxYen).toBe(100);
    expect(decision.resolutionStatus).toBe("contradictory");
    expect(decision.reasons).toContain("conflicting_printed_tax_lines");
  });

  it("generic税額とgrand totalの不一致を矛盾として残す", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("消費税額 80円", 80, 8), line("税合計 100円", 100, 9)],
        receiptLineClassifications: [classification(8, "tax"), classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount.printedTaxYen).toBe(100);
    expect(decision.resolutionStatus).toBe("contradictory");
    expect(decision.reasons).toContain("conflicting_printed_tax_lines");
  });

  it("区分不明の複数generic税明細は税額を確定しない", () => {
    const decision = interpretReceiptTaxDecision(
      baseInput({
        taxSummaries: [summary({ status: "ambiguous" })],
        rawObservationLines: [line("消費税額 80円", 80, 8), line("消費税額 80円", 80, 9)],
        receiptLineClassifications: [classification(8, "tax"), classification(9, "tax")],
      }),
    );

    expect(decision.taxAmount.printedTaxYen).toBeUndefined();
    expect(decision.resolutionStatus).toBe("contradictory");
  });
});

import { describe, expect, it } from "vitest";
import { parseOpenAIResponse } from "./extraction";

const trialExtraction = {
  documentType: "receipt",
  shopName: "TRIAL",
  paymentPlace: "",
  payeeName: "",
  paymentPurpose: "",
  date: "2026-07-03",
  amountYen: 1683,
  categoryName: "食費",
  items: [
    {
      itemName: "たまご",
      printedAmountYen: 298,
      amountBasis: "tax_excluded",
      taxRatePercent: 8,
      taxMarker: "*",
      quantity: 1,
      unitPriceYen: 298,
      categoryName: "食費",
      confidence: {
        itemName: 1,
        printedAmountYen: 1,
        amountBasis: 1,
        taxRatePercent: 1,
        categoryName: 1,
      },
      warnings: [],
    },
  ],
  taxSummaries: [
    {
      taxRatePercent: 8,
      taxMode: "external",
      taxableAmountYen: 1559,
      taxableAmountBasis: "tax_excluded",
      taxYen: 124,
      taxIncludedAmountYen: 1683,
      roundingMethod: "floor",
      confidence: {
        taxRatePercent: 1,
        taxMode: 1,
        taxableAmountYen: 1,
        taxableAmountBasis: 1,
        taxYen: 1,
      },
      warnings: [],
    },
  ],
  confidence: {
    documentType: 1,
    shopName: 1,
    paymentPlace: 1,
    payeeName: 1,
    paymentPurpose: 1,
    date: 1,
    amountYen: 1,
    categoryName: 1,
  },
  warnings: [],
};

function parse(payload: unknown) {
  return parseOpenAIResponse({
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(payload) }],
      },
    ],
  });
}

describe("parseOpenAIResponse domain", () => {
  it("正常系: TRIAL 外税をパースする", () => {
    const result = parse(trialExtraction);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.extracted.amountYen).toBe(1683);
    expect(result.extracted.items?.[0]).toMatchObject({
      printedAmountYen: 298,
      amountBasis: "tax_excluded",
      taxRatePercent: 8,
    });
    expect(result.extracted.taxSummaries?.[0]).toMatchObject({
      taxRatePercent: 8,
      taxMode: "external",
      taxableAmountYen: 1559,
      taxYen: 124,
    });
  });

  it("不正な税率はエラー結果を返す", () => {
    const payload = structuredClone(trialExtraction);
    payload.items[0].taxRatePercent = 0.08;
    const result = parse(payload);
    expect(result.success).toBe(false);
  });

  it("不正な shopName はエラー結果を返す", () => {
    const payload = structuredClone(trialExtraction);
    payload.shopName = "";
    const result = parse(payload);
    expect(result.success).toBe(false);
  });

  it("不合理な構造化年を2桁年の生観測から復元する", () => {
    const payload = structuredClone(trialExtraction) as typeof trialExtraction & {
      rawObservations: Array<Record<string, unknown>>;
    };
    payload.date = "2674-07-24";
    payload.rawObservations = [
      {
        rawText: "26年07月24日 10:08",
        amountText: null,
        amountYen: null,
        lineRoleCandidates: ["unknown"],
        roleConfidence: 0.8,
        explicitlyPrinted: true,
        sourceLineIndex: 0,
        boundingBox: null,
      },
    ];
    const result = parse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.extracted.date).toBe("2026-07-24");
    expect(result.extracted.warnings).toContain("date_recovered_from_raw_observations");
  });

  it("構造化された2桁和暦風年をraw観測なしで正規化する", () => {
    const payload = structuredClone(trialExtraction);
    payload.date = "26年07月24日";
    const result = parse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.extracted.date).toBe("2026-07-24");
    expect(result.extracted.warnings).toContain("date_normalized_from_structured_value");
  });

  it("期限日の生観測を購入日として復元しない", () => {
    const payload = structuredClone(trialExtraction) as typeof trialExtraction & {
      rawObservations: Array<Record<string, unknown>>;
    };
    payload.date = "2674-07-24";
    payload.rawObservations = [
      {
        rawText: "ポイント有効期限 2026年09月30日",
        amountText: null,
        amountYen: null,
        lineRoleCandidates: ["unknown"],
        roleConfidence: 0.8,
        explicitlyPrinted: true,
        sourceLineIndex: 0,
        boundingBox: null,
      },
    ];
    expect(parse(payload).success).toBe(false);
  });
});

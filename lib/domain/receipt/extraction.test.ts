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
});

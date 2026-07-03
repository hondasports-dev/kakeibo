import { describe, expect, it } from "vitest";
import { parseOpenAIResponse } from "./parseExtraction";

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

type MutableTaxExtraction = {
  items: Array<Record<string, unknown>>;
  taxSummaries: Array<Record<string, unknown>>;
};

describe("parseOpenAIResponse tax boundary", () => {
  it("TRIAL外税の整数税率・印字額・税率別集計を通す", () => {
    const result = parse(trialExtraction);

    expect(result.amountYen).toBe(1683);
    expect(result.items?.[0]).toMatchObject({
      printedAmountYen: 298,
      amountBasis: "tax_excluded",
      taxRatePercent: 8,
    });
    expect(result.taxSummaries?.[0]).toMatchObject({
      taxRatePercent: 8,
      taxMode: "external",
      taxableAmountYen: 1559,
      taxYen: 124,
    });
  });

  it.each([0, 8, 10, null])("item税率 %s を通す", (taxRatePercent) => {
    const payload = structuredClone(trialExtraction);
    payload.items[0].taxRatePercent = taxRatePercent as never;
    expect(parse(payload).items?.[0].taxRatePercent).toBe(taxRatePercent);
  });

  it.each([0.08, 0.1, "8", 9])("item不正税率 %s を落とす", (taxRatePercent) => {
    const payload = structuredClone(trialExtraction) as unknown as MutableTaxExtraction;
    payload.items[0].taxRatePercent = taxRatePercent;
    expect(() => parse(payload)).toThrow(/taxRatePercent/);
  });

  it("局所化されたenumを落とす", () => {
    const itemPayload = structuredClone(trialExtraction) as unknown as MutableTaxExtraction;
    itemPayload.items[0].amountBasis = "税込";
    expect(() => parse(itemPayload)).toThrow(/amountBasis/);

    const summaryPayload = structuredClone(trialExtraction) as unknown as MutableTaxExtraction;
    summaryPayload.taxSummaries[0].taxMode = "外税";
    expect(() => parse(summaryPayload)).toThrow(/taxMode/);
  });

  it.each([
    ["taxableAmountYen", 1559.5],
    ["taxYen", 124.5],
    ["taxYen", -1],
  ])("taxSummariesの不正金額 %s=%s を落とす", (field, value) => {
    const payload = structuredClone(trialExtraction) as unknown as MutableTaxExtraction;
    payload.taxSummaries[0][field] = value;
    expect(() => parse(payload)).toThrow(new RegExp(field));
  });

  it("通常明細の負の印字額を落とし、割引明細では許容する", () => {
    const invalid = structuredClone(trialExtraction);
    invalid.items[0].printedAmountYen = -100;
    expect(() => parse(invalid)).toThrow(/printedAmountYen/);

    const discount = structuredClone(trialExtraction);
    discount.items[0].itemName = "クーポン割引";
    discount.items[0].printedAmountYen = -100;
    expect(parse(discount).items?.[0].printedAmountYen).toBe(-100);
  });
});

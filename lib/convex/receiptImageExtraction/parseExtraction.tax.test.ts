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
  rawObservations: [
    {
      rawText: "合計 ￥1,683",
      amountText: "￥1,683",
      amountYen: 1683,
      lineRoleCandidates: ["total"],
      roleConfidence: 0.98,
      explicitlyPrinted: true,
      sourceLineIndex: 12,
      boundingBox: null,
    },
    {
      rawText: "消費税 0円",
      amountText: "0円",
      amountYen: 0,
      lineRoleCandidates: ["tax", "unknown"],
      roleConfidence: 0.6,
      explicitlyPrinted: true,
      sourceLineIndex: 13,
      boundingBox: { left: 0.1, top: 0.7, width: 0.8, height: 0.03 },
    },
  ],
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

  it("OCR原文・金額文字列・0円・role候補を補正せず保持する", () => {
    const result = parse(trialExtraction);

    expect(result.rawObservations).toEqual([
      {
        rawText: "合計 ￥1,683",
        amountText: "￥1,683",
        amountYen: 1683,
        lineRoleCandidates: ["total"],
        roleConfidence: 0.98,
        explicitlyPrinted: true,
        sourceLineIndex: 12,
        boundingBox: undefined,
      },
      expect.objectContaining({
        rawText: "消費税 0円",
        amountText: "0円",
        amountYen: 0,
        lineRoleCandidates: ["tax", "unknown"],
        boundingBox: { left: 0.1, top: 0.7, width: 0.8, height: 0.03 },
      }),
    ]);
  });

  it("支払総額不明のnullと印字された0円観測を区別する", () => {
    const payload = structuredClone(trialExtraction);
    payload.amountYen = null as never;
    payload.rawObservations[0].amountText = null;
    payload.rawObservations[0].amountYen = null;

    const result = parse(payload);

    expect(result.amountYen).toBeNull();
    expect(result.rawObservations?.[0].amountYen).toBeNull();
    expect(result.rawObservations?.[1].amountYen).toBe(0);
  });

  it("印字されたtop-level 0円を観測値としてparseし、nullと区別する", () => {
    const payload = structuredClone(trialExtraction);
    payload.amountYen = 0;
    payload.rawObservations[0] = {
      ...payload.rawObservations[0],
      rawText: "合計 0円",
      amountText: "0円",
      amountYen: 0,
      lineRoleCandidates: ["total"],
    };

    const result = parse(payload);

    expect(result.amountYen).toBe(0);
    expect(result.rawObservations?.[0]).toMatchObject({ amountText: "0円", amountYen: 0 });
  });

  it("raw observationの不正role・confidence・boundingBoxを拒否する", () => {
    const role = structuredClone(trialExtraction) as unknown as {
      rawObservations: Array<Record<string, unknown>>;
    };
    role.rawObservations[0].lineRoleCandidates = ["確定合計"];
    expect(() => parse(role)).toThrow(/lineRoleCandidates/);

    const confidence = structuredClone(trialExtraction) as unknown as {
      rawObservations: Array<Record<string, unknown>>;
    };
    confidence.rawObservations[0].roleConfidence = 1.1;
    expect(() => parse(confidence)).toThrow(/roleConfidence/);

    const box = structuredClone(trialExtraction) as unknown as {
      rawObservations: Array<Record<string, unknown>>;
    };
    box.rawObservations[1].boundingBox = { left: -1, top: 0, width: 1, height: 1 };
    expect(() => parse(box)).toThrow(/boundingBox/);
  });

  it("parserでは外税の金額関係から税属性を補正しない", () => {
    const payload = structuredClone(trialExtraction);
    payload.items[0].printedAmountYen = 1559;
    payload.items[0].amountBasis = "unknown";
    payload.taxSummaries[0].taxMode = "included";
    payload.taxSummaries[0].taxableAmountBasis = "tax_included";

    const result = parse(payload);

    expect(result.items?.[0].amountBasis).toBe("unknown");
    expect(result.taxSummaries?.[0]).toMatchObject({
      taxMode: "included",
      taxableAmountBasis: "tax_included",
    });
  });

  it("税額を含む対象額の内税判定は維持する", () => {
    const payload = structuredClone(trialExtraction);
    payload.amountYen = 110;
    payload.items[0].printedAmountYen = 110;
    payload.items[0].amountBasis = "tax_included";
    payload.taxSummaries[0].taxMode = "included";
    payload.taxSummaries[0].taxableAmountYen = 110;
    payload.taxSummaries[0].taxableAmountBasis = "tax_included";
    payload.taxSummaries[0].taxYen = 10;
    payload.taxSummaries[0].taxIncludedAmountYen = 110;

    const result = parse(payload);

    expect(result.items?.[0].amountBasis).toBe("tax_included");
    expect(result.taxSummaries?.[0].taxMode).toBe("included");
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

  it("負額を行種別付きで保持し、不確実な通常行は行単位warningにする", () => {
    const promotion = structuredClone(trialExtraction);
    promotion.items[0].itemName = "M002 玉ねぎ3玉";
    promotion.items[0].printedAmountYen = -16;
    (promotion.items[0] as Record<string, unknown>).lineType = "promotion_adjustment";
    expect(parse(promotion).items?.[0]).toMatchObject({
      lineType: "promotion_adjustment",
      printedAmountYen: -16,
      warnings: [],
    });

    const invalidProduct = structuredClone(trialExtraction);
    invalidProduct.items[0].printedAmountYen = -100;
    (invalidProduct.items[0] as Record<string, unknown>).lineType = "item";
    expect(parse(invalidProduct).items?.[0]).toMatchObject({
      lineType: "item",
      printedAmountYen: -100,
      warnings: ["negative_amount_on_product_line"],
    });

    const legacyUnknown = structuredClone(trialExtraction);
    legacyUnknown.items[0].itemName = "M001 東洋水産よりどり";
    legacyUnknown.items[0].printedAmountYen = -10;
    expect(parse(legacyUnknown).items?.[0]).toMatchObject({
      lineType: "unknown",
      warnings: ["negative_amount_line_type_uncertain"],
    });
  });

  it("46件の長尺結果にkeywordless負額販促行があっても全体を保持する", () => {
    const payload = structuredClone(trialExtraction);
    const base = payload.items[0];
    payload.items = Array.from({ length: 44 }, (_, index) => ({
      ...structuredClone(base),
      itemName: `商品${index + 1}`,
      printedAmountYen: 100,
      lineType: "item",
    })) as typeof payload.items;
    payload.items.push(
      {
        ...structuredClone(base),
        itemName: "M002 玉ねぎ3玉",
        printedAmountYen: -16,
        lineType: "promotion_adjustment",
      } as never,
      {
        ...structuredClone(base),
        itemName: "M001 東洋水産よりどり",
        printedAmountYen: -10,
        lineType: "promotion_adjustment",
      } as never,
    );

    const result = parse(payload);

    expect(result.items).toHaveLength(46);
    expect(result.items?.slice(-2)).toEqual([
      expect.objectContaining({ itemName: "M002 玉ねぎ3玉", printedAmountYen: -16 }),
      expect.objectContaining({ itemName: "M001 東洋水産よりどり", printedAmountYen: -10 }),
    ]);
  });
});

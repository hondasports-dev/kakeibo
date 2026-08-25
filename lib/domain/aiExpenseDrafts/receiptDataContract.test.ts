import { describe, expect, it } from "vitest";
import { applyReceiptUserOverride, type ReceiptDraftValueSnapshot } from "./receiptDataContract";

const aiValues: ReceiptDraftValueSnapshot = {
  status: "needs_review",
  documentType: "receipt",
  shopName: "新しいAI店舗",
  date: "2026-08-25",
  amountYen: 803,
  confidence: { shopName: 0.95, date: 0.95, amountYen: 0.8 },
  warnings: ["新しいAI警告"],
  reviewReasons: ["user_confirmation_required"],
  items: [
    {
      itemName: "新しいAI商品",
      amountYen: 803,
      confidence: { itemName: 0.9, amountYen: 0.9 },
    },
  ],
};

describe("applyReceiptUserOverride", () => {
  it("対象の金額だけを維持し、未補正のAI再解析値は更新する", () => {
    const merged = applyReceiptUserOverride(aiValues, {
      source: "user",
      updatedAt: 1,
      fields: ["amountYen"],
      values: {
        status: "ready",
        documentType: "receipt",
        shopName: "古い店舗",
        date: "2026-07-01",
        amountYen: 7803,
        confidence: { shopName: 1, date: 1, amountYen: 1 },
        warnings: [],
        reviewReasons: [],
        items: [{ itemName: "古い商品", amountYen: 7803, confidence: {} }],
      },
    });

    expect(merged).toMatchObject({
      status: "needs_review",
      shopName: "新しいAI店舗",
      date: "2026-08-25",
      amountYen: 7803,
      confidence: { shopName: 0.95, date: 0.95, amountYen: 1 },
      warnings: ["新しいAI警告"],
      items: [expect.objectContaining({ itemName: "新しいAI商品" })],
    });
  });

  it("明細・税率別集計は安定したcollection単位の対象指定で維持する", () => {
    const overriddenItems = [{ itemName: "補正商品", amountYen: 803, confidence: {} }];
    const merged = applyReceiptUserOverride(aiValues, {
      source: "user",
      updatedAt: 1,
      fields: ["items", "taxSummaries"],
      values: {
        ...aiValues,
        items: overriddenItems,
        taxSummaries: [
          {
            taxRatePercent: 10,
            taxMode: "included",
            taxableAmountYen: 803,
            taxableAmountBasis: "tax_included",
            taxYen: 73,
            taxIncludedAmountYen: 803,
            roundingMethod: "floor",
            confidence: {},
            warnings: [],
          },
        ],
      },
    });

    expect(merged.items).toEqual(overriddenItems);
    expect(merged.taxSummaries?.[0]).toMatchObject({ taxableAmountYen: 803, taxYen: 73 });
  });

  it("ユーザー確定したtotal resolutionを新AI候補より優先して維持する", () => {
    const userResolution = {
      status: "verified" as const,
      protectedAmountYen: 7803,
      candidates: [
        { amountYen: 7803, source: "user_confirmed" as const, evidence: "review.amountYen" },
      ],
      reasons: [],
    };
    const merged = applyReceiptUserOverride(
      {
        ...aiValues,
        amountYen: 900,
        receiptTotalResolution: {
          status: "verified",
          protectedAmountYen: 900,
          candidates: [{ amountYen: 900, source: "explicit_label", evidence: "new ai" }],
          reasons: [],
        },
      },
      {
        source: "user",
        updatedAt: 1,
        fields: ["amountYen", "receiptTotalResolution"],
        values: { ...aiValues, amountYen: 7803, receiptTotalResolution: userResolution },
      },
    );

    expect(merged.amountYen).toBe(7803);
    expect(merged.receiptTotalResolution).toEqual(userResolution);
  });
});

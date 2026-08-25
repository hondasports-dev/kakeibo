import { describe, expect, it } from "vitest";
import type { CategoryLike } from "../categories/candidate";
import {
  conveniencePaymentFixture,
  ishimoriExternalMisreadFixture,
  trialExternal8Fixture,
} from "../../convex/receiptImageExtraction/fixtures/taxFixtures";
import { mapExtractionToDraftArgs } from "./extractionMapping";

const foodCategory: CategoryLike<string> = {
  _id: "cat-food",
  name: "食費",
};

describe("mapExtractionToDraftArgs tax normalization", () => {
  it("TRIAL外税を正規化し、印字額・按分税・登録額を分離する", () => {
    const mapped = mapExtractionToDraftArgs(trialExternal8Fixture, [foodCategory]);

    expect(mapped.amountYen).toBe(1683);
    expect(mapped.taxSummaries?.[0]).toMatchObject({ taxRatePercent: 8, taxYen: 124 });
    expect(mapped.items?.reduce((sum, item) => sum + (item.printedAmountYen ?? 0), 0)).toBe(1559);
    expect(mapped.items?.reduce((sum, item) => sum + (item.allocatedTaxYen ?? 0), 0)).toBe(124);
    expect(mapped.items?.reduce((sum, item) => sum + (item.normalizedAmountYen ?? 0), 0)).toBe(
      1683,
    );
    expect(mapped.items?.every((item) => item.categoryId === foodCategory._id)).toBe(true);
    expect(mapped.items?.every((item) => item.taxResolutionStatus === "resolved")).toBe(true);
    expect(mapped.items?.every((item) => item.taxResolutionSource !== undefined)).toBe(true);
    expect(mapped.reviewReasons).toBeUndefined();
  });

  it("金額不整合をwarningとamount_mismatchへ送る", () => {
    const mapped = mapExtractionToDraftArgs({ ...trialExternal8Fixture, amountYen: 9999 }, [
      foodCategory,
    ]);
    expect(mapped.warnings).toContain("normalized_amount_mismatch");
    expect(mapped.reviewReasons).toContain("amount_mismatch");
  });

  it("TRIAL内税レシートの税額行96円を商品明細へ二重計上しない", () => {
    const product = trialExternal8Fixture.items![0];
    const source = {
      ...trialExternal8Fixture,
      amountYen: 1060,
      items: [
        {
          ...product,
          itemName: "内ヒキャメル・メンソール",
          amountYen: 1060,
          printedAmountYen: 1060,
          amountBasis: "tax_included" as const,
          taxRatePercent: 10 as const,
          markers: [],
          taxMarker: "",
          quantity: 2,
          unitPriceYen: 530,
        },
        {
          ...product,
          itemName: "(10%内税 タイショウ)",
          amountYen: 1060,
          printedAmountYen: 1060,
          amountBasis: "tax_included" as const,
          taxRatePercent: 10 as const,
          markers: [],
          taxMarker: "",
        },
        {
          ...product,
          itemName: "(10%内税)",
          amountYen: 96,
          printedAmountYen: 96,
          amountBasis: "tax_included" as const,
          taxRatePercent: 10 as const,
          markers: [],
          taxMarker: "",
        },
      ],
      taxSummaries: [
        {
          ...trialExternal8Fixture.taxSummaries![0],
          taxRatePercent: 10 as const,
          taxMode: "included" as const,
          taxableAmountYen: 1060,
          taxableAmountBasis: "tax_included" as const,
          taxYen: 96,
          taxIncludedAmountYen: 1060,
        },
      ],
    };

    const mapped = mapExtractionToDraftArgs(source, [foodCategory]);

    expect(mapped.items).toHaveLength(1);
    expect(mapped.items?.[0]).toMatchObject({
      itemName: "内ヒキャメル・メンソール",
      printedAmountYen: 1060,
      normalizedAmountYen: 1060,
    });
    expect(mapped.warnings).not.toContain("normalized_amount_mismatch");
    expect(mapped.reviewReasons).toBeUndefined();
  });

  it("税関連語を含む商品名だけでは明細から除外しない", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 96,
        items: [
          {
            ...product,
            itemName: "内税対応商品",
            amountYen: 96,
            printedAmountYen: 96,
            amountBasis: "tax_included",
            taxRatePercent: 10,
            markers: [],
            taxMarker: "",
          },
        ],
        taxSummaries: [
          {
            ...trialExternal8Fixture.taxSummaries![0],
            taxRatePercent: 10,
            taxMode: "included",
            taxableAmountYen: 96,
            taxableAmountBasis: "tax_included",
            taxYen: 96,
            taxIncludedAmountYen: 96,
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.items).toHaveLength(1);
    expect(mapped.items?.[0]?.itemName).toBe("内税対応商品");
  });

  it("明細のない払込票には金額不整合を付与しない", () => {
    const mapped = mapExtractionToDraftArgs(conveniencePaymentFixture, [foodCategory]);

    expect(mapped.items).toEqual([]);
    expect(mapped.warnings).not.toContain("normalized_amount_mismatch");
    expect(mapped.reviewReasons).toBeUndefined();
  });

  it("税率を一意に解決できない明細を確認対象へ送る", () => {
    const source = {
      ...trialExternal8Fixture,
      amountYen: 1000,
      items: [
        ...trialExternal8Fixture.items!.slice(0, 3).map((item, index) => ({
          ...item,
          amountYen: [300, 300, 400][index],
          printedAmountYen: [300, 300, 400][index],
          amountBasis: "unknown" as const,
          taxRatePercent: null,
          markers: [],
          taxMarker: "",
        })),
      ],
      taxSummaries: [
        {
          ...trialExternal8Fixture.taxSummaries![0],
          taxableAmountYen: 500,
          taxYen: 0,
          taxMode: "included" as const,
          taxableAmountBasis: "tax_included" as const,
        },
        {
          ...trialExternal8Fixture.taxSummaries![0],
          taxRatePercent: 10 as const,
          taxableAmountYen: 500,
          taxYen: 0,
          taxMode: "included" as const,
          taxableAmountBasis: "tax_included" as const,
        },
      ],
    };
    const mapped = mapExtractionToDraftArgs(source, [foodCategory]);
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
    expect(mapped.items?.every((item) => item.taxResolutionStatus === "unresolved")).toBe(true);
    expect(mapped.items?.every((item) => item.taxRatePercent === null)).toBe(true);
    expect(mapped.warnings).toContain("unresolved_tax_rate:items[0]");
  });

  it("フレッシュ石守相当のOCR内税誤判定を算術一致だけで外税化しない", () => {
    const mapped = mapExtractionToDraftArgs(ishimoriExternalMisreadFixture, [foodCategory]);

    expect(mapped.amountYen).toBe(8562);
    expect(mapped.taxSummaries?.[0]).toMatchObject({
      taxRatePercent: 8,
      taxMode: "included",
      taxableAmountBasis: "tax_included",
      status: "contradictory",
    });
    expect(mapped.items?.reduce((sum, item) => sum + (item.printedAmountYen ?? 0), 0)).toBe(7958);
    expect(mapped.items?.reduce((sum, item) => sum + (item.allocatedTaxYen ?? 0), 0)).toBe(0);
    expect(mapped.items?.reduce((sum, item) => sum + (item.normalizedAmountYen ?? 0), 0)).toBe(
      7958,
    );
    expect(
      mapped.items
        ?.filter((item) => item.printedAmountYen !== undefined && item.printedAmountYen >= 0)
        .every((item) => item.taxResolutionStatus === "unresolved"),
    ).toBe(true);
    expect(mapped.warnings).toContain("ambiguous_receipt_total");
    expect(mapped.reviewReasons).toContain("amount_mismatch");
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
    expect(mapped.items?.[2]?.taxResolutionStatus).toBe("unresolved");
    expect(mapped.items?.[2]?.taxRatePercent).toBeNull();
  });

  it("7,803円の支払総額を743円+60円の税算術候補で置換しない", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 7803,
        items: [
          {
            ...product,
            itemName: "商品",
            amountYen: 743,
            printedAmountYen: 743,
            amountBasis: "unknown",
            taxRatePercent: null,
            markers: [],
          },
        ],
        taxSummaries: [
          {
            ...trialExternal8Fixture.taxSummaries![0],
            taxableAmountYen: 743,
            taxYen: 60,
            taxIncludedAmountYen: 803,
            taxMode: "external",
            taxableAmountBasis: "tax_excluded",
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.amountYen).toBe(7803);
    expect(mapped.receiptTotalResolution).toMatchObject({
      status: "ambiguous",
      protectedAmountYen: 7803,
      candidates: expect.arrayContaining([
        expect.objectContaining({
          amountYen: 7803,
          source: "explicit_label",
          evidence: "extraction.amountYen",
        }),
        expect.objectContaining({ amountYen: 803, source: "tax_arithmetic" }),
      ]),
    });
    expect(mapped.items?.[0]).toMatchObject({
      printedAmountYen: 743,
      normalizedAmountYen: 743,
      allocatedTaxYen: 0,
      taxResolutionStatus: "unresolved",
    });
    expect(mapped.warnings).toContain("ambiguous_receipt_total");
    expect(mapped.reviewReasons).toEqual(
      expect.arrayContaining(["amount_mismatch", "user_confirmation_required"]),
    );
  });

  it("明細0件でも支払総額と抽出根拠を下書きへ渡す", () => {
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 7803,
        items: [],
        taxSummaries: [],
      },
      [foodCategory],
    );

    expect(mapped.amountYen).toBe(7803);
    expect(mapped.receiptTotalResolution).toEqual({
      status: "verified",
      protectedAmountYen: 7803,
      candidates: [
        {
          amountYen: 7803,
          source: "explicit_label",
          evidence: "extraction.amountYen",
        },
      ],
      reasons: [],
    });
  });

  it("支払総額不明の0円は金額を保存せず、確認待ちの根拠だけ保持する", () => {
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 0,
        items: [],
        taxSummaries: [],
        confidence: { ...trialExternal8Fixture.confidence, amountYen: 0.1 },
      },
      [foodCategory],
    );

    expect(mapped.amountYen).toBeUndefined();
    expect(mapped.receiptTotalResolution).toMatchObject({
      status: "ambiguous",
      protectedAmountYen: 0,
      reasons: ["receipt_total_missing_or_invalid"],
    });
  });
});

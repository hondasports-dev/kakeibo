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
  it("8%内税と10%外税の混在を率別に解決して支払総額へ一致させる", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 320,
        items: [
          {
            ...product,
            itemName: "食品",
            amountYen: 100,
            printedAmountYen: 100,
            amountBasis: "tax_included",
            taxRatePercent: 8,
          },
          {
            ...product,
            itemName: "日用品",
            amountYen: 200,
            printedAmountYen: 200,
            amountBasis: "tax_excluded",
            taxRatePercent: 10,
          },
        ],
        taxSummaries: [
          {
            ...trialExternal8Fixture.taxSummaries![0],
            taxRatePercent: 8,
            taxMode: "included",
            taxableAmountYen: 100,
            taxableAmountBasis: "tax_included",
            taxYen: 7,
            taxIncludedAmountYen: 100,
          },
          {
            ...trialExternal8Fixture.taxSummaries![0],
            taxRatePercent: 10,
            taxMode: "external",
            taxableAmountYen: 200,
            taxableAmountBasis: "unknown",
            taxYen: 20,
            taxIncludedAmountYen: 220,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items?.map((item) => item.normalizedAmountYen)).toEqual([100, 220]);
    expect(mapped.items?.reduce((sum, item) => sum + (item.normalizedAmountYen ?? 0), 0)).toBe(320);
    expect(mapped.taxSummaries?.[1]).toMatchObject({
      taxMode: "external",
      taxableAmountBasis: "tax_excluded",
      status: "verified",
    });
  });

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
    expect(mapped.receiptTaxDecision).toMatchObject({
      priceTaxTreatment: "excluded",
      taxRateComposition: "rate8",
      candidates: expect.any(Array),
    });
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

  it("内税額のOCR誤読を金額一致なしで明細から除外する", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 1080,
        items: [
          { ...product, itemName: "商品", amountYen: 1080, printedAmountYen: 1080 },
          { ...product, itemName: "内税", amountYen: 56, printedAmountYen: 56 },
        ],
        taxSummaries: [
          {
            ...trialExternal8Fixture.taxSummaries![0],
            taxableAmountYen: 1080,
            taxYen: 58,
            taxIncludedAmountYen: 1080,
            taxMode: "included",
            taxableAmountBasis: "tax_included",
          },
        ],
        rawObservations: [
          {
            rawText: "商品 1,080円",
            amountText: "1,080円",
            amountYen: 1080,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
          {
            rawText: "内税 58円",
            amountText: "56円",
            amountYen: 56,
            lineRoleCandidates: ["item", "unknown"],
            roleConfidence: 0.45,
            explicitlyPrinted: true,
            sourceLineIndex: 8,
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.items?.map((item) => item.itemName)).toEqual(["商品"]);
    expect(mapped.receiptLineClassifications?.[1]?.candidates[0]).toMatchObject({ role: "tax" });
  });

  it("税率別対象額がAI item候補でも構造ラベルで明細から除外する", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [
          { ...product, itemName: "商品", amountYen: 1000, printedAmountYen: 1000 },
          { ...product, itemName: "8%対象", amountYen: 927, printedAmountYen: 927 },
        ],
        rawObservations: [
          {
            rawText: "商品 1,000円",
            amountText: "1,000円",
            amountYen: 1000,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
          {
            rawText: "8%対象 927円",
            amountText: "927円",
            amountYen: 927,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 8,
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.items?.map((item) => item.itemName)).toEqual(["商品"]);
    expect(mapped.receiptLineClassifications?.[1]?.candidates[0]?.role).toBe("tax");
  });

  it("支払方法金額は明細から外し、袋代はfeeとして残す", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 1005,
        items: [
          { ...product, itemName: "商品", amountYen: 1000, printedAmountYen: 1000 },
          { ...product, itemName: "レジ袋", amountYen: 5, printedAmountYen: 5 },
          { ...product, itemName: "VISA", amountYen: 1005, printedAmountYen: 1005 },
        ],
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "商品 1,000円",
            amountText: "1,000円",
            amountYen: 1000,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
          {
            rawText: "レジ袋 5円",
            amountText: "5円",
            amountYen: 5,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 2,
          },
          {
            rawText: "VISA 1,005円",
            amountText: "1,005円",
            amountYen: 1005,
            lineRoleCandidates: ["payment"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 9,
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.items?.map((item) => item.itemName)).toEqual(["商品", "レジ袋"]);
    expect(mapped.receiptLineClassifications?.map((line) => line.candidates[0]?.role)).toEqual([
      "item",
      "fee",
      "paymentMethodAmount",
    ]);
  });

  it("分類不能な金額行をunknownのまま確認対象へ送る", () => {
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [],
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "読取不能",
            amountText: "777円",
            amountYen: 777,
            lineRoleCandidates: ["unknown"],
            roleConfidence: 0.2,
            explicitlyPrinted: true,
            sourceLineIndex: 4,
          },
        ],
      },
      [foodCategory],
    );

    expect(mapped.receiptLineClassifications?.[0]).toMatchObject({
      status: "ambiguous",
      candidates: [expect.objectContaining({ role: "unknown" })],
    });
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
    expect(mapped.warnings).toContain("ambiguous_receipt_line:4");
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

  it("支払総額nullは0円候補を作らず、raw observationをそのまま渡す", () => {
    const rawObservations = [
      {
        rawText: "合計 読取不能",
        amountText: null,
        amountYen: null,
        lineRoleCandidates: ["total" as const, "unknown" as const],
        roleConfidence: 0.4,
        explicitlyPrinted: true,
        sourceLineIndex: 9,
      },
      {
        rawText: "消費税 0円",
        amountText: "0円",
        amountYen: 0,
        lineRoleCandidates: ["tax" as const],
        roleConfidence: 0.9,
        explicitlyPrinted: true,
        sourceLineIndex: 10,
      },
    ];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: null,
        items: [],
        taxSummaries: [],
        rawObservations,
      },
      [foodCategory],
    );

    expect(mapped.amountYen).toBeUndefined();
    expect(mapped.receiptTotalResolution).toEqual({
      status: "ambiguous",
      protectedAmountYen: null,
      candidates: [],
      reasons: ["receipt_total_missing_or_invalid"],
    });
    expect(mapped.rawObservationLines).toEqual(rawObservations);
  });

  it("0円の非金銭ポイント行を除外し、負額割引は保持する", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [
          product,
          { ...product, itemName: "ポイント10倍", amountYen: 0, printedAmountYen: 0 },
          { ...product, itemName: "クーポン値引", amountYen: -20, printedAmountYen: -20 },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items?.map((item) => item.itemName)).not.toContain("ポイント10倍");
    expect(mapped.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemName: "クーポン値引", amountYen: -20 }),
      ]),
    );
  });

  it("曖昧な価格付き抽出商品を削除せず確認対象に残す", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [{ ...product, itemName: "読取不鮮明商品", amountYen: 198, printedAmountYen: 198 }],
        rawObservations: [
          {
            rawText: "読取不鮮明商品 198円",
            amountText: "198円",
            amountYen: 198,
            lineRoleCandidates: ["item", "unknown"],
            roleConfidence: 0.2,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemName: "読取不鮮明商品" })]),
    );
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
  });

  it("未消費の明示価格商品をraw observationから復元する", () => {
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [],
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "コカ・コーラ 88円",
            amountText: "88円",
            amountYen: 88,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.98,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items).toEqual([
      expect.objectContaining({
        itemName: "コカ・コーラ",
        printedAmountYen: 88,
        warnings: expect.arrayContaining(["item_recovered_from_raw_observation"]),
      }),
    ]);
  });

  it("同名同額の複数行を一対一で対応させて重複復元しない", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 200,
        items: [
          { ...product, itemName: "同じ商品", amountYen: 100, printedAmountYen: 100 },
          { ...product, itemName: "同じ商品", amountYen: 100, printedAmountYen: 100 },
        ],
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "同じ商品 100円",
            amountText: "100円",
            amountYen: 100,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.99,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
          {
            rawText: "同じ商品 100円",
            amountText: "100円",
            amountYen: 100,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.99,
            explicitlyPrinted: true,
            sourceLineIndex: 2,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items).toHaveLength(2);
    expect(mapped.items?.map((item) => item.printedAmountYen)).toEqual([100, 100]);
  });

  it("同名行の金額が食い違っても二重復元せず確認対象にする", () => {
    const product = trialExternal8Fixture.items![0];
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        items: [{ ...product, itemName: "商品A", amountYen: 198, printedAmountYen: 198 }],
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "商品A 188円",
            amountText: "188円",
            amountYen: 188,
            lineRoleCandidates: ["item"],
            roleConfidence: 0.99,
            explicitlyPrinted: true,
            sourceLineIndex: 1,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.items).toHaveLength(1);
    expect(mapped.items?.[0]).toMatchObject({ itemName: "商品A", printedAmountYen: 198 });
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
  });

  it("構造化税summary欠落時に明示税行から復元する", () => {
    const mapped = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        amountYen: 530,
        taxSummaries: [],
        rawObservations: [
          {
            rawText: "(10%内税 対象) 530円",
            amountText: "530円",
            amountYen: 530,
            lineRoleCandidates: ["tax"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 10,
          },
          {
            rawText: "(10%内税額) 48円",
            amountText: "48円",
            amountYen: 48,
            lineRoleCandidates: ["tax"],
            roleConfidence: 0.95,
            explicitlyPrinted: true,
            sourceLineIndex: 11,
          },
        ],
      },
      [foodCategory],
    );
    expect(mapped.taxSummaries).toEqual([
      expect.objectContaining({ taxRatePercent: 10, taxMode: "included", taxYen: 48 }),
    ]);
  });

  it("全明細のカテゴリが空ならレシート全体カテゴリを補完する", () => {
    const source = {
      ...trialExternal8Fixture,
      categoryName: "食費",
      items: trialExternal8Fixture.items!.map((item) => ({ ...item, categoryName: "" })),
    };
    const mapped = mapExtractionToDraftArgs(source, [foodCategory]);
    expect(mapped.items?.every((item) => item.categoryId === foodCategory._id)).toBe(true);
    expect(mapped.items?.every((item) => item.categoryName === foodCategory.name)).toBe(true);
  });
});

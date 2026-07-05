import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  conveniencePaymentFixture,
  ishimoriExternalMisreadFixture,
  trialExternal8Fixture,
} from "../../lib/convex/receiptImageExtraction/fixtures/taxFixtures";
import { mapExtractionToDraftArgs } from "./extractionMapping";

const foodCategory: Doc<"categories"> = {
  _id: "cat-food" as Id<"categories">,
  _creationTime: 1,
  groupId: "group-1" as Id<"groups">,
  name: "食費",
  color: "#000000",
  isActive: true,
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1,
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

  it("フレッシュ石守相当のOCR内税誤判定を外税として正規化する", () => {
    const mapped = mapExtractionToDraftArgs(ishimoriExternalMisreadFixture, [foodCategory]);

    expect(mapped.amountYen).toBe(8562);
    expect(mapped.taxSummaries?.[0]).toMatchObject({
      taxRatePercent: 8,
      taxMode: "external",
      taxableAmountBasis: "tax_excluded",
    });
    expect(mapped.items?.reduce((sum, item) => sum + (item.printedAmountYen ?? 0), 0)).toBe(7958);
    expect(mapped.items?.reduce((sum, item) => sum + (item.allocatedTaxYen ?? 0), 0)).toBe(604);
    expect(mapped.items?.reduce((sum, item) => sum + (item.normalizedAmountYen ?? 0), 0)).toBe(
      8562,
    );
    expect(
      mapped.items
        ?.filter((item) => item.printedAmountYen !== undefined && item.printedAmountYen >= 0)
        .every((item) => item.taxResolutionStatus === "resolved"),
    ).toBe(true);
    expect(mapped.warnings).toContain("taxable_amount_mismatch:8");
    expect(mapped.reviewReasons).toContain("amount_mismatch");
    expect(mapped.reviewReasons).toContain("user_confirmation_required");
    expect(mapped.items?.[2]?.taxResolutionStatus).toBe("unresolved");
    expect(mapped.items?.[2]?.taxRatePercent).toBeNull();
  });
});

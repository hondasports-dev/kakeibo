import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  conveniencePaymentFixture,
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
    expect(mapped.reviewReasons).toBeUndefined();
  });

  it("金額不整合をwarningとamount_mismatchへ送る", () => {
    const mapped = mapExtractionToDraftArgs({ ...trialExternal8Fixture, amountYen: 9999 }, [
      foodCategory,
    ]);
    expect(mapped.warnings).toContain("normalized_amount_mismatch");
    expect(mapped.reviewReasons).toContain("amount_mismatch");
  });

  it("明細のない払込票には金額不整合を付与しない", () => {
    const mapped = mapExtractionToDraftArgs(conveniencePaymentFixture, [foodCategory]);

    expect(mapped.items).toEqual([]);
    expect(mapped.warnings).not.toContain("normalized_amount_mismatch");
    expect(mapped.reviewReasons).toBeUndefined();
  });
});

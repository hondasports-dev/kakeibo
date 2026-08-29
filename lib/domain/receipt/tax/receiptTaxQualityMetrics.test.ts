import { describe, expect, it } from "vitest";
import { receiptTaxGoldenCaseLedger } from "./fixtures/receiptTaxGoldenCaseLedger";
import {
  buildReceiptTaxQualityMetrics,
  formatReceiptTaxQualityMetrics,
} from "./receiptTaxQualityMetrics";

describe("receipt tax quality metrics", () => {
  it("匿名台帳からOFF01〜OFF07を同じ分母規則で集計する", () => {
    const result = buildReceiptTaxQualityMetrics(receiptTaxGoldenCaseLedger);

    expect(result).toMatchObject({
      totalCases: 38,
      availableCases: 20,
      unavailableCases: 18,
      groundTruthReviewedCases: 18,
      preConfirmationCases: 1,
    });
    expect(result.metrics).toEqual([
      { id: "OFF01", numerator: 20, denominator: 38, percentage: (20 / 38) * 100 },
      { id: "OFF02", numerator: 18, denominator: 20, percentage: 90 },
      { id: "OFF03", numerator: 1, denominator: 18, percentage: (1 / 18) * 100 },
      { id: "OFF04", numerator: 2, denominator: 18, percentage: (2 / 18) * 100 },
      { id: "OFF05", numerator: 10, denominator: 18, percentage: (10 / 18) * 100 },
      { id: "OFF06", numerator: 3, denominator: 18, percentage: (3 / 18) * 100 },
      { id: "OFF07", numerator: 0, denominator: 20, percentage: 0 },
    ]);
  });

  it("revisionと資料不足件数を機械出力へ含める", () => {
    const output = formatReceiptTaxQualityMetrics(
      buildReceiptTaxQualityMetrics(receiptTaxGoldenCaseLedger),
      "test-revision",
    );

    expect(output).toContain("revision: test-revision");
    expect(output).toContain("unavailable_cases: 18");
    for (const id of ["OFF01", "OFF02", "OFF03", "OFF04", "OFF05", "OFF06", "OFF07"]) {
      expect(output).toContain(`${id}:`);
    }
  });
});

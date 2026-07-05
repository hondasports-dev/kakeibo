import { describe, expect, it } from "vitest";
import { resolveReviewItemAmountsForReplace } from "./reviewValidation";

describe("resolveReviewItemAmountsForReplace", () => {
  it("外税確定で印字金額が変わらなければ印字額と登録用金額を維持する", () => {
    expect(
      resolveReviewItemAmountsForReplace(298, {
        amountYen: 322,
        printedAmountYen: 298,
        normalizedAmountYen: 322,
        taxResolutionStatus: "resolved",
        amountBasis: "tax_excluded",
      }),
    ).toEqual({
      amountYen: 322,
      printedAmountYen: 298,
      normalizedAmountYen: 322,
    });
  });

  it("外税確定で印字金額を変更したら登録用金額は再計算に任せる", () => {
    expect(
      resolveReviewItemAmountsForReplace(300, {
        amountYen: 322,
        printedAmountYen: 298,
        normalizedAmountYen: 322,
        taxResolutionStatus: "resolved",
        amountBasis: "tax_excluded",
      }),
    ).toEqual({
      amountYen: 300,
      printedAmountYen: 300,
      normalizedAmountYen: undefined,
    });
  });

  it("未確定明細は送信値を印字金額として扱う", () => {
    expect(resolveReviewItemAmountsForReplace(99, undefined)).toEqual({
      amountYen: 99,
      printedAmountYen: 99,
    });
  });
});

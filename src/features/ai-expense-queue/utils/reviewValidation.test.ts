import { describe, expect, it } from "vitest";
import { getReviewFormError } from "./reviewValidation";

describe("getReviewFormError", () => {
  it("店名・内容が空の場合は送信を拒否する", () => {
    expect(
      getReviewFormError({
        documentType: "receipt",
        shopName: "   ",
        date: "2026-06-01",
        amountYen: "9120",
        categoryId: "cat-daily",
      }),
    ).toBe("店名・内容、日付、金額、カテゴリを確認してください。");
  });
});

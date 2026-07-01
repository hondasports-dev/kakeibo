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
    ).toBe("店名・内容、支出日、金額、カテゴリを確認してください。");
  });

  it("存在しない支出日やYYYY-MM-DD以外の日付を拒否する", () => {
    const base = {
      documentType: "receipt" as const,
      shopName: "スーパー青葉",
      amountYen: "9120",
      categoryId: "cat-daily",
    };
    expect(getReviewFormError({ ...base, date: "2026-02-30" })).not.toBeNull();
    expect(getReviewFormError({ ...base, date: "2026/06/01" })).not.toBeNull();
  });
});

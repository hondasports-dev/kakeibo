import { describe, expect, it } from "vitest";
import { getReviewFormError, getReviewItemsError } from "./reviewValidation";

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

describe("getReviewItemsError", () => {
  it("カテゴリが残っていても割引対象の商品が未選択なら拒否する", () => {
    expect(
      getReviewItemsError([
        {
          id: "discount",
          itemName: "クーポン割引",
          amountYen: "-110",
          categoryId: "cat-daily",
        },
      ]),
    ).toBe("割引対象の商品を選択してください。");
  });

  it("割引対象が選択済みならカテゴリ不足を通常の明細エラーとして扱う", () => {
    expect(
      getReviewItemsError([
        {
          id: "discount",
          itemName: "クーポン割引",
          amountYen: "-110",
          categoryId: "",
          discountTargetItemId: "product",
        },
      ]),
    ).toBe("明細名、明細金額、カテゴリを確認してください。");
  });
});

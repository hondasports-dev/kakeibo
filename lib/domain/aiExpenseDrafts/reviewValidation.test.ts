import { describe, expect, it } from "vitest";
import {
  getReviewCategoryAggregateErrorMessage,
  getReviewDocumentTypeErrorMessage,
  getReviewFormErrorMessage,
  getReviewItemsErrorMessage,
  getReviewSubmitErrorMessage,
  type ReviewFormInput,
  type ReviewItemInput,
} from "./reviewValidation";

const baseForm: ReviewFormInput = {
  documentType: "receipt",
  shopName: "スーパー青葉",
  date: "2026-06-01",
  amountYen: "9120",
  categoryId: "cat-daily",
};

const validItem: ReviewItemInput = { itemName: "牛乳", amountYen: "200", categoryId: "cat-daily" };
const discountItem: ReviewItemInput = {
  itemName: "クーポン割引",
  amountYen: "-110",
  categoryId: "cat-daily",
};

describe("getReviewDocumentTypeErrorMessage", () => {
  it("unknown は書類種別未選択エラー", () => {
    expect(getReviewDocumentTypeErrorMessage("unknown")).toBe("書類種別を選択してください。");
  });

  it("receipt / convenience_payment はエラーなし", () => {
    expect(getReviewDocumentTypeErrorMessage("receipt")).toBeNull();
    expect(getReviewDocumentTypeErrorMessage("convenience_payment")).toBeNull();
  });
});

describe("getReviewFormErrorMessage", () => {
  it("店名が空の場合はエラー", () => {
    expect(
      getReviewFormErrorMessage({
        ...baseForm,
        shopName: "   ",
      }),
    ).toBe("店名・内容、支出日、金額、カテゴリを確認してください。");
  });

  it("実在しない支出日を拒否する", () => {
    expect(getReviewFormErrorMessage({ ...baseForm, date: "2026-02-30" })).not.toBeNull();
  });

  it("YYYY-MM-DD 以外の日付を拒否する", () => {
    expect(getReviewFormErrorMessage({ ...baseForm, date: "2026/06/01" })).not.toBeNull();
  });

  it("有効な入力はエラーなし", () => {
    expect(getReviewFormErrorMessage(baseForm)).toBeNull();
  });
});

describe("getReviewItemsErrorMessage", () => {
  it("割引対象の商品が未選択ならエラー", () => {
    expect(getReviewItemsErrorMessage([discountItem])).toBe("割引対象の商品を選択してください。");
  });

  it("割引対象が選択済みならカテゴリ不足を通常の明細エラーとして扱う", () => {
    expect(
      getReviewItemsErrorMessage([
        {
          ...discountItem,
          categoryId: "",
          discountTargetItemId: "product",
        },
      ]),
    ).toBe("明細名、明細金額、カテゴリを確認してください。");
  });

  it("明細名が空の場合はエラー", () => {
    expect(
      getReviewItemsErrorMessage([
        {
          itemName: "  ",
          amountYen: "110",
          categoryId: "cat-daily",
        },
      ]),
    ).toBe("明細名、明細金額、カテゴリを確認してください。");
  });

  it("有効な明細はエラーなし", () => {
    expect(getReviewItemsErrorMessage([validItem])).toBeNull();
  });
});

describe("getReviewCategoryAggregateErrorMessage", () => {
  it("カテゴリ合計が 0 以下ならエラー", () => {
    expect(
      getReviewCategoryAggregateErrorMessage([
        { itemName: "商品", amountYen: "200", categoryId: "cat-daily" },
        { itemName: "クーポン割引", amountYen: "-200", categoryId: "cat-daily" },
      ]),
    ).toBe("割引後のカテゴリ金額は1円以上にしてください。");
  });

  it("カテゴリ合計が正ならエラーなし", () => {
    expect(getReviewCategoryAggregateErrorMessage([validItem])).toBeNull();
  });
});

describe("getReviewSubmitErrorMessage", () => {
  it("ドキュメント種別エラーを優先する", () => {
    expect(getReviewSubmitErrorMessage({ ...baseForm, documentType: "unknown" }, [validItem])).toBe(
      "書類種別を選択してください。",
    );
  });

  it("フォームエラーを優先する", () => {
    expect(getReviewSubmitErrorMessage({ ...baseForm, shopName: "" }, [validItem])).toBe(
      "店名・内容、支出日、金額、カテゴリを確認してください。",
    );
  });

  it("明細エラーを優先する", () => {
    expect(getReviewSubmitErrorMessage(baseForm, [discountItem])).toBe(
      "割引対象の商品を選択してください。",
    );
  });

  it("カテゴリ集計エラーを最後に判定する", () => {
    expect(
      getReviewSubmitErrorMessage(baseForm, [
        { itemName: "商品", amountYen: "200", categoryId: "cat-daily" },
        {
          itemName: "クーポン割引",
          amountYen: "-200",
          categoryId: "cat-daily",
          discountTargetItemId: "product",
        },
      ]),
    ).toBe("割引後のカテゴリ金額は1円以上にしてください。");
  });

  it("有効な入力はエラーなし", () => {
    expect(getReviewSubmitErrorMessage(baseForm, [validItem])).toBeNull();
  });

  it("totalOnlyはOCR明細が不完全でも合計フォームだけで保存できる", () => {
    expect(
      getReviewSubmitErrorMessage({ ...baseForm, registrationMode: "totalOnly" }, [
        { itemName: "", amountYen: "", categoryId: "" },
      ]),
    ).toBeNull();
  });
});

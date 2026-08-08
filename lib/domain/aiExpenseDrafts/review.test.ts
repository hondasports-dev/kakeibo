import { describe, expect, it } from "vitest";
import {
  buildReviewConfidence,
  getReviewUpdateReadyErrorMessage,
  hasCounterparty,
  validateReviewUpdateCanBecomeReady,
} from "./review";

describe("hasCounterparty", () => {
  it("receipt で店舗名があれば true", () => {
    expect(hasCounterparty({ documentType: "receipt", shopName: "スーパー" })).toBe(true);
  });

  it("receipt で店舗名・支払先・支払場所がすべて空なら false", () => {
    expect(hasCounterparty({ documentType: "receipt" })).toBe(false);
  });

  it.each([{ payeeName: "電力会社" }, { paymentPlace: "東京都" }])(
    "receipt で支払先・支払場所があれば true: %o",
    (args) => {
      expect(hasCounterparty({ documentType: "receipt", ...args })).toBe(true);
    },
  );

  it("convenience_payment で店舗名があれば true", () => {
    expect(hasCounterparty({ documentType: "convenience_payment", shopName: "コンビニ" })).toBe(
      true,
    );
  });

  it("convenience_payment は支払先・支払目的が両方必要", () => {
    expect(hasCounterparty({ documentType: "convenience_payment", payeeName: "電力会社" })).toBe(
      false,
    );
    expect(
      hasCounterparty({
        documentType: "convenience_payment",
        payeeName: "電力会社",
        paymentPurpose: "電気代",
      }),
    ).toBe(true);
  });

  it("unknown も店舗名等があれば true", () => {
    expect(hasCounterparty({ documentType: "unknown", shopName: "店" })).toBe(true);
  });

  it("空白のみは空とみなす", () => {
    expect(hasCounterparty({ documentType: "receipt", shopName: "   " })).toBe(false);
  });
});

describe("validateReviewUpdateCanBecomeReady", () => {
  it("全て有効なら success", () => {
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "receipt",
        date: "2024-01-15",
        amountYen: 1000,
        shopName: "スーパー",
      }),
    ).toEqual({ success: true });
  });

  it("documentType が unknown なら失敗", () => {
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "unknown",
        date: "2024-01-15",
        amountYen: 1000,
        shopName: "店",
      }),
    ).toEqual({ success: false, error: "unknown_document_type" });
  });

  it("date が空・無効なら失敗", () => {
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "receipt",
        date: "",
        amountYen: 1000,
        shopName: "店",
      }),
    ).toEqual({ success: false, error: "missing_date" });
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "receipt",
        date: "2024-02-30",
        amountYen: 1000,
        shopName: "店",
      }),
    ).toEqual({ success: false, error: "invalid_date" });
  });

  it("amountYen が無効なら失敗", () => {
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "receipt",
        date: "2024-01-15",
        amountYen: 0,
        shopName: "店",
      }),
    ).toEqual({ success: false, error: "invalid_amount" });
  });

  it("相手方情報が不足なら失敗", () => {
    expect(
      validateReviewUpdateCanBecomeReady({
        documentType: "receipt",
        date: "2024-01-15",
        amountYen: 1000,
      }),
    ).toEqual({ success: false, error: "missing_counterparty" });
  });
});

describe("buildReviewConfidence", () => {
  it("確定フィールドは 1、未入力は既存スコアを維持する", () => {
    const draftConfidence = {
      documentType: 0.5,
      shopName: 0.5,
      paymentPlace: 0.5,
      payeeName: 0.5,
      paymentPurpose: 0.5,
      date: 0.5,
      amountYen: 0.5,
      categoryId: 0.5,
    };
    expect(
      buildReviewConfidence(draftConfidence, {
        shopName: "  スーパー  ",
        paymentPlace: "  東京都  ",
      }),
    ).toEqual({
      documentType: 1,
      shopName: 1,
      paymentPlace: 1,
      payeeName: 1,
      paymentPurpose: 1,
      date: 1,
      amountYen: 1,
      categoryId: 1,
    });
  });

  it("shopName がない場合 payeeName / paymentPurpose は shopName にフォールバックしない", () => {
    const draftConfidence = {
      payeeName: 0.5,
      paymentPurpose: 0.5,
    };
    expect(
      buildReviewConfidence(draftConfidence, {
        payeeName: "電力会社",
        paymentPurpose: "電気代",
      }),
    ).toEqual({
      documentType: 1,
      payeeName: 1,
      paymentPurpose: 1,
      date: 1,
      amountYen: 1,
      categoryId: 1,
    });
  });

  it("入力が空の場合は既存スコアを維持する", () => {
    const draftConfidence = { shopName: 0.3 };
    expect(buildReviewConfidence(draftConfidence, { shopName: "" })).toEqual({
      documentType: 1,
      shopName: 0.3,
      paymentPlace: undefined,
      payeeName: undefined,
      paymentPurpose: undefined,
      date: 1,
      amountYen: 1,
      categoryId: 1,
    });
  });
});

describe("getReviewUpdateReadyErrorMessage", () => {
  it.each([
    ["unknown_document_type", undefined, "Draft document type must be selected to mark ready"],
    ["missing_date", undefined, "Draft date is required to mark ready"],
    ["invalid_date", undefined, "Draft date must be a valid YYYY-MM-DD date"],
    ["invalid_amount", undefined, "Draft amount is required to mark ready"],
    [
      "missing_counterparty",
      "receipt",
      "Draft shop, payment place, or payee is required to mark ready",
    ],
    [
      "missing_counterparty",
      "convenience_payment",
      "Draft shop name or payment details are required to mark ready",
    ],
  ] as const)("%s (documentType=%s) -> %s", (error, documentType, expected) => {
    expect(getReviewUpdateReadyErrorMessage(error, documentType)).toBe(expected);
  });
});

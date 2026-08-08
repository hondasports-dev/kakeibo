import { describe, expect, it } from "vitest";
import { hasCounterparty, validateReviewUpdateCanBecomeReady } from "./review";

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

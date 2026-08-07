import { describe, expect, it } from "vitest";
import { hasCounterparty } from "./review";

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

import { describe, expect, it } from "vitest";
import { resolveReceiptShopNameFromDraft } from "./shopName";

describe("resolveReceiptShopNameFromDraft", () => {
  it("レシートは shopName を優先する", () => {
    expect(
      resolveReceiptShopNameFromDraft({ documentType: "receipt", shopName: "  ファミマ  " }),
    ).toBe("ファミマ");
  });

  it("レシートで shopName がなければ payeeName/paymentPlace を fallback する", () => {
    expect(
      resolveReceiptShopNameFromDraft({ documentType: "receipt", payeeName: "電力会社" }),
    ).toBe("電力会社");
    expect(
      resolveReceiptShopNameFromDraft({ documentType: "receipt", paymentPlace: "オンライン" }),
    ).toBe("オンライン");
  });

  it("convenience_payment は payeeName + paymentPurpose を優先する", () => {
    expect(
      resolveReceiptShopNameFromDraft({
        documentType: "convenience_payment",
        payeeName: "電力",
        paymentPurpose: "  6月分  ",
      }),
    ).toBe("電力 6月分");
  });

  it("不明なときは 不明 を返す", () => {
    expect(resolveReceiptShopNameFromDraft({ documentType: "unknown" })).toBe("不明");
  });
});

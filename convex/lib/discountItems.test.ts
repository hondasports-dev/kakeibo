import { describe, expect, it } from "vitest";
import { isDiscountItemName, isValidSignedLineItemAmount } from "./discountItems";

describe("discountItems", () => {
  it("割引明細のみ負数を許可する", () => {
    expect(isValidSignedLineItemAmount("クーポン券割引", -110)).toBe(true);
    expect(isValidSignedLineItemAmount("キュレル ジェルメイク", -110)).toBe(false);
    expect(isValidSignedLineItemAmount("不明な明細", 0)).toBe(false);
  });

  it("値引き・クーポン・割戻しを割引明細として判定する", () => {
    expect(isDiscountItemName("クーポン券割引 10% ")).toBe(true);
    expect(isDiscountItemName("商品値引き")).toBe(true);
    expect(isDiscountItemName("ポイント割戻し")).toBe(true);
    expect(isDiscountItemName("消費税計")).toBe(false);
  });
});

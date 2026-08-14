import { describe, expect, it } from "vitest";
import { getTaxWarningMessage, isDialogHiddenTaxWarning } from "./warnings";

describe("isDialogHiddenTaxWarning", () => {
  it("normalized_amount_mismatch は非表示", () => {
    expect(isDialogHiddenTaxWarning("normalized_amount_mismatch")).toBe(true);
  });

  it("unknown_amount_basis: は非表示", () => {
    expect(isDialogHiddenTaxWarning("unknown_amount_basis:foo")).toBe(true);
  });

  it("unknown_tax_rate: は非表示", () => {
    expect(isDialogHiddenTaxWarning("unknown_tax_rate:10")).toBe(true);
  });

  it("taxable_amount_mismatch: は非表示", () => {
    expect(isDialogHiddenTaxWarning("taxable_amount_mismatch:8")).toBe(true);
  });

  it("missing_tax_items: は表示", () => {
    expect(isDialogHiddenTaxWarning("missing_tax_items:10")).toBe(false);
  });
});

describe("getTaxWarningMessage", () => {
  it.each([
    ["normalized_amount_mismatch", "お支払いと読み取った商品の合計が一致しません。"],
    ["unknown_tax_rate:10", "税率が未確定の明細があります。"],
    ["unknown_amount_basis:8", "税込・税抜が未確定の明細があります。"],
    ["taxable_amount_mismatch:foo", "読み取った商品の合計とレシート小計が一致しません。"],
    ["missing_tax_items:8", "税率別集計に対応する明細がありません。"],
    ["some_unknown_key", "金額を確認してください。"],
    ["free form text", "free form text"],
  ] as const)("%s -> %s", (warning, expected) => {
    expect(getTaxWarningMessage(warning)).toBe(expected);
  });
});

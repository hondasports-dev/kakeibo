import { describe, expect, it } from "vitest";
import { isDialogHiddenTaxWarning } from "./warnings";

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

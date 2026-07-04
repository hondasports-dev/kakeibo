import { describe, expect, it } from "vitest";
import { formatTaxWarning } from "./taxWarnings";

describe("formatTaxWarning", () => {
  it("税正規化の機械コードを日本語へ変換する", () => {
    expect(formatTaxWarning("normalized_amount_mismatch")).toBe(
      "登録金額と支払合計に差があります。",
    );
    expect(formatTaxWarning("unknown_tax_rate:items[0]")).toBe(
      "税率を確認できない明細があります。",
    );
    expect(formatTaxWarning("unknown_amount_basis:items[0]")).toBe(
      "税込・税抜を確認できない明細があります。",
    );
    expect(formatTaxWarning("taxable_amount_mismatch:8")).toBe(
      "印字額と税率別対象額に差があります。",
    );
    expect(formatTaxWarning("missing_tax_items:10")).toBe("税率別集計に対応する明細がありません。");
    expect(formatTaxWarning("future_tax_warning")).toBe("税情報を確認してください。");
  });

  it("既存の日本語warningはそのまま返す", () => {
    expect(formatTaxWarning("品名が不鮮明です")).toBe("品名が不鮮明です");
  });
});

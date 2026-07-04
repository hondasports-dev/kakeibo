const warningLabels: Record<string, string> = {
  normalized_amount_mismatch: "登録金額と支払合計に差があります。",
};

export function formatTaxWarning(warning: string) {
  if (warning.startsWith("unknown_tax_rate:")) return "税率を確認できない明細があります。";
  if (warning.startsWith("unknown_amount_basis:")) {
    return "税込・税抜を確認できない明細があります。";
  }
  if (warning.startsWith("taxable_amount_mismatch:")) {
    return "印字額と税率別対象額に差があります。";
  }
  if (warning.startsWith("missing_tax_items:")) {
    return "税率別集計に対応する明細がありません。";
  }
  return (
    warningLabels[warning] ??
    (/^[a-z][a-z0-9_]*(?::.*)?$/.test(warning) ? "税情報を確認してください。" : warning)
  );
}

export function formatTaxWarnings(warnings: string[]) {
  return warnings.map(formatTaxWarning).join(" / ");
}

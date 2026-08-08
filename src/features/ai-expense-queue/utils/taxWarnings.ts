import { isDialogHiddenTaxWarning } from "../../../../lib/domain/receipt/tax/warnings";

const warningLabels: Record<string, string> = {
  normalized_amount_mismatch: "お支払いと読み取った商品の合計が一致しません。",
};

export function formatTaxWarning(warning: string) {
  if (warning.startsWith("unknown_tax_rate:")) {
    return "税率が未確定の明細があります。";
  }
  if (warning.startsWith("unknown_amount_basis:")) {
    return "税込・税抜が未確定の明細があります。";
  }
  if (warning.startsWith("taxable_amount_mismatch:")) {
    return "読み取った商品の合計とレシート小計が一致しません。";
  }
  if (warning.startsWith("missing_tax_items:")) {
    return "税率別集計に対応する明細がありません。";
  }
  return (
    warningLabels[warning] ??
    (/^[a-z][a-z0-9_]*(?::.*)?$/.test(warning) ? "金額を確認してください。" : warning)
  );
}

export function formatTaxWarnings(warnings: string[]) {
  const counts = new Map<string, number>();
  warnings.forEach((warning) => {
    const label = formatTaxWarning(warning);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => (count > 1 ? `${label}（${count}件）` : label))
    .join(" / ");
}

export { isDialogHiddenTaxWarning } from "../../../../lib/domain/receipt/tax/warnings";

export function formatTaxWarningsForDialog(warnings: string[]) {
  return formatTaxWarnings(warnings.filter((warning) => !isDialogHiddenTaxWarning(warning)));
}

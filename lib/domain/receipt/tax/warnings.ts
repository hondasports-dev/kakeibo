/**
 * UI ダイアログで集計パネルに統合するため非表示にする税関連 warning キー。
 */
export function isDialogHiddenTaxWarning(warning: string): boolean {
  if (
    warning === "normalized_amount_mismatch" ||
    warning.startsWith("unknown_amount_basis:") ||
    warning.startsWith("unknown_tax_rate:") ||
    warning.startsWith("taxable_amount_mismatch:")
  ) {
    return true;
  }
  return false;
}

const taxWarningMessages: Record<string, string> = {
  normalized_amount_mismatch: "お支払いと読み取った商品の合計が一致しません。",
};

/** 税関連 warning をユーザー向けメッセージに変換する。 */
export function getTaxWarningMessage(warning: string): string {
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
    taxWarningMessages[warning] ??
    (/^[a-z][a-z0-9_]*(?::.*)?$/.test(warning) ? "金額を確認してください。" : warning)
  );
}

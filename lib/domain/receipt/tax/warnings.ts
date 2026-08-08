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

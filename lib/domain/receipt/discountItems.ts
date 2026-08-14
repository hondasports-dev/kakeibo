/**
 * レシート・AI 下書きの割引明細に関するドメインルール。
 * UI / Convex の両方から利用できる純粋関数のみを含む。
 */

const DISCOUNT_ITEM_PATTERN = /(割引|値引|クーポン|割戻|割り戻|ポイント利用|ポイント充当)/;

/** 明細名が割引・値引・クーポン・ポイント利用等かどうかを判定する。 */
export function isDiscountItemName(itemName: string): boolean {
  return DISCOUNT_ITEM_PATTERN.test(itemName.trim());
}

/**
 * 符号付き明細金額が有効かどうかを判定する。
 * 通常明細は正の整数のみ、割引明細は負の整数も許容する。0 と非整数は不可。
 */
export function isValidSignedLineItemAmount(itemName: string, amountYen: number): boolean {
  if (!Number.isInteger(amountYen) || amountYen === 0) {
    return false;
  }
  return amountYen > 0 || isDiscountItemName(itemName);
}

/**
 * ユーザー入力された金額文字列を正規化する。
 * 割引明細で先頭が "-" の場合は負数を維持し、それ以外は数字のみを残す。
 */
export function sanitizeSignedYenInput(itemName: string, value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return value.trim() === "-" && isDiscountItemName(itemName) ? "-" : "";
  }
  return value.trimStart().startsWith("-") && isDiscountItemName(itemName) ? `-${digits}` : digits;
}

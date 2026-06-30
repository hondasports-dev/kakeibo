const DISCOUNT_ITEM_PATTERN = /(割引|値引|クーポン|割戻|割り戻|ポイント利用|ポイント充当)/;

export function isDiscountItemName(itemName: string): boolean {
  return DISCOUNT_ITEM_PATTERN.test(itemName.trim());
}

export function sanitizeSignedYenInput(itemName: string, value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return value.trim() === "-" && isDiscountItemName(itemName) ? "-" : "";
  }
  return value.trimStart().startsWith("-") && isDiscountItemName(itemName) ? `-${digits}` : digits;
}

export function isValidReviewItemAmount(itemName: string, amountYen: number): boolean {
  if (!Number.isInteger(amountYen) || amountYen === 0) {
    return false;
  }
  return amountYen > 0 || isDiscountItemName(itemName);
}

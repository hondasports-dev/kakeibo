const DISCOUNT_ITEM_PATTERN = /(割引|値引|クーポン|割戻|割り戻|ポイント利用|ポイント充当)/;

export function isDiscountItemName(itemName: string): boolean {
  return DISCOUNT_ITEM_PATTERN.test(itemName.trim());
}

export function isValidSignedLineItemAmount(itemName: string, amountYen: number): boolean {
  if (!Number.isInteger(amountYen) || amountYen === 0) {
    return false;
  }
  return amountYen > 0 || isDiscountItemName(itemName);
}

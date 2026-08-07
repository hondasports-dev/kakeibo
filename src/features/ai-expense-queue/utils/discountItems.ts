/**
 * 割引明細に関する UI アダプタ。
 * 純粋なドメインルールは lib/domain/receipt/discountItems.ts に委ねる。
 */
import {
  isDiscountItemName as isDiscountItemNameDomain,
  isValidSignedLineItemAmount,
  sanitizeSignedYenInput as sanitizeSignedYenInputDomain,
} from "../../../../lib/domain/receipt/discountItems";

export { isDiscountItemNameDomain as isDiscountItemName };
export { sanitizeSignedYenInputDomain as sanitizeSignedYenInput };

/** フロントエンドでの别名。 signed line item amount と同じルールを使う。 */
export function isValidReviewItemAmount(itemName: string, amountYen: number): boolean {
  return isValidSignedLineItemAmount(itemName, amountYen);
}

/**
 * 割引明細に関する Convex アダプタ。
 * 純粋なドメインルールは lib/domain/receipt/discountItems.ts に委ねる。
 */
export {
  isDiscountItemName,
  isValidSignedLineItemAmount,
} from "../../lib/domain/receipt/discountItems";

import { trimOptional } from "../common/string";

export type AiExpenseDraftDocumentType = "receipt" | "convenience_payment" | "unknown";

export type HasCounterpartyArgs = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
};

/** 下書きに対して相手方情報（店舗名・支払先・支払目的等）が存在するか判定する */
export function hasCounterparty(args: HasCounterpartyArgs): boolean {
  if (args.documentType === "convenience_payment") {
    return (
      !!trimOptional(args.shopName) ||
      (!!trimOptional(args.payeeName) && !!trimOptional(args.paymentPurpose))
    );
  }
  return (
    !!trimOptional(args.shopName) ||
    !!trimOptional(args.payeeName) ||
    !!trimOptional(args.paymentPlace)
  );
}

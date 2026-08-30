export const RECEIPT_LINE_ROLES = [
  "item",
  "discount",
  "tax",
  "subtotal",
  "total",
  "payment",
  "change",
  "unknown",
] as const;

export type ReceiptLineRole = (typeof RECEIPT_LINE_ROLES)[number];

export type ReceiptObservationBoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ReceiptRawObservationLine = {
  rawText: string;
  amountText: string | null;
  amountYen: number | null;
  lineRoleCandidates: ReceiptLineRole[];
  roleConfidence: number;
  explicitlyPrinted: boolean;
  sourceLineIndex: number;
  boundingBox?: ReceiptObservationBoundingBox;
};

export type ReceiptRawObservation = {
  source: "ai_ocr" | "legacy_projection";
  observedAt: number;
  lines: ReceiptRawObservationLine[];
};

export const RECEIPT_STRUCTURAL_LINE_ROLES = [
  "item",
  "itemDiscount",
  "receiptDiscount",
  "coupon",
  "pointsUsed",
  "fee",
  "tax",
  "subtotal",
  "totalCandidate",
  "paymentMethodAmount",
  "cashReceived",
  "change",
  "unknown",
] as const;

export type ReceiptStructuralLineRole = (typeof RECEIPT_STRUCTURAL_LINE_ROLES)[number];

export type ReceiptLineClassificationCandidate = {
  role: ReceiptStructuralLineRole;
  score: number;
  evidence: string[];
};

export type ReceiptLineClassification = {
  sourceLineIndex: number;
  status: "classified" | "ambiguous";
  candidates: ReceiptLineClassificationCandidate[];
};

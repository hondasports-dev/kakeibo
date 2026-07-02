export type ExtractionConfidence = {
  shopName: number;
  date: number;
  amountYen: number;
  documentType?: number;
  paymentPlace?: number;
  payeeName?: number;
  paymentPurpose?: number;
  categoryName?: number;
};

export type ExtractReceiptItemResult = {
  itemName: string;
  amountYen: number;
  categoryName?: string;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
  };
  warnings: string[];
};

export type ExtractReceiptFieldsResult = {
  shopName: string;
  date: string;
  amountYen: number;
  documentType: "receipt" | "convenience_payment" | "unknown";
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  categoryName?: string;
  items?: ExtractReceiptItemResult[];
  confidence: ExtractionConfidence;
  warnings: string[];
};

export type OpenAIResponsesApiResponse = {
  output: Array<{
    type: string;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
};

export type ExtractedFields = ExtractReceiptFieldsResult;

export type ExtractReceiptFieldsArgs = {
  imageDataUrl: string;
  categoryNames?: string[];
};

export type OpenAIReceiptExtractorArgs = {
  imageDataUrl: string;
  apiKey: string;
  categoryNames?: string[];
};

/** Convex string value の 1MB 制限を下回る imageDataUrl の最大長 */
export const MAX_IMAGE_DATA_URL_LENGTH = 900_000;
export const MAX_EXTRACTED_LINE_ITEMS = 100;
export const JAPAN_TIME_ZONE = "Asia/Tokyo";

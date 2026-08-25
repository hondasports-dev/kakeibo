import { MAX_IMAGE_DATA_URL_LENGTH as _MAX_IMAGE_DATA_URL_LENGTH } from "../../../lib/domain/common/imageDataUrl";
import {
  JAPAN_TIME_ZONE as _JAPAN_TIME_ZONE,
  MAX_EXTRACTED_LINE_ITEMS as _MAX_EXTRACTED_LINE_ITEMS,
} from "../../../lib/domain/receipt/extraction";
import type { ReceiptRawObservationLine } from "../../../lib/domain/receipt/observations";
export type { ReceiptRawObservationLine } from "../../../lib/domain/receipt/observations";

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

export type TaxRatePercent = 0 | 8 | 10;
export type ReceiptItemTaxRatePercent = TaxRatePercent | null;
export type AmountBasis = "tax_included" | "tax_excluded" | "unknown";
export type TaxMode = "external" | "included" | "mixed" | "unknown";
export type RoundingMethod = "floor" | "round" | "ceil" | "unknown";

export type ExtractReceiptItemResult = {
  itemName: string;
  /** @deprecated 税対応の抽出結果では printedAmountYen を使用する。 */
  amountYen: number;
  /** #411/#412 の schema・parse 移行完了までは既存レスポンスとの互換用に optional。 */
  printedAmountYen?: number;
  amountBasis?: AmountBasis;
  taxRatePercent?: ReceiptItemTaxRatePercent;
  markers?: string[];
  /** @deprecated markers を使用する。 */
  taxMarker?: string;
  quantity?: number;
  unitPriceYen?: number;
  categoryName?: string;
  confidence: {
    itemName?: number;
    amountYen?: number;
    printedAmountYen?: number;
    amountBasis?: number;
    taxRatePercent?: number;
    categoryName?: number;
  };
  warnings: string[];
};

export type ReceiptMarkerDefinition = {
  marker: string;
  description: string;
};

export type ExtractedTaxSummary = {
  taxRatePercent: TaxRatePercent;
  taxMode: TaxMode;
  taxableAmountYen: number;
  taxableAmountBasis: AmountBasis;
  taxYen: number;
  taxIncludedAmountYen?: number;
  roundingMethod: RoundingMethod;
  confidence: {
    taxRatePercent?: number;
    taxMode?: number;
    taxableAmountYen?: number;
    taxableAmountBasis?: number;
    taxYen?: number;
  };
  warnings: string[];
};

export type ExtractReceiptFieldsResult = {
  shopName: string;
  date: string;
  amountYen: number | null;
  documentType: "receipt" | "convenience_payment" | "unknown";
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  categoryName?: string;
  items?: ExtractReceiptItemResult[];
  taxSummaries?: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  rawObservations?: ReceiptRawObservationLine[];
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
  categories?: ReceiptCategoryHint[];
  /** @deprecated Use categories so descriptions reach the extractor. */
  categoryNames?: string[];
};

export type ReceiptCategoryHint = {
  name: string;
  description?: string;
};

export type OpenAIReceiptExtractorArgs = {
  imageDataUrl: string;
  apiKey: string;
  categories?: ReceiptCategoryHint[];
  /** @deprecated Use categories so descriptions reach the extractor. */
  categoryNames?: string[];
};

/** Convex string value の 1MB 制限を下回る imageDataUrl の最大長 */
export const MAX_IMAGE_DATA_URL_LENGTH = _MAX_IMAGE_DATA_URL_LENGTH;
export const MAX_EXTRACTED_LINE_ITEMS = _MAX_EXTRACTED_LINE_ITEMS;
export const JAPAN_TIME_ZONE = _JAPAN_TIME_ZONE;

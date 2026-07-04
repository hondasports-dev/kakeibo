export type TaxRatePercent = 0 | 8 | 10;
export type AmountBasis = "tax_included" | "tax_excluded" | "unknown";
export type ResolvedAmountBasis = Exclude<AmountBasis, "unknown">;
export type TaxMode = "external" | "included" | "mixed" | "unknown";
export type RoundingMethod = "floor" | "round" | "ceil" | "unknown";

export type ReceiptMarkerDefinition = { marker: string; description: string };

export type ExtractedReceiptItem = {
  itemName: string;
  printedAmountYen: number;
  taxRatePercent: TaxRatePercent | null;
  amountBasis: AmountBasis;
  markers: string[];
  /** @deprecated 既存の抽出・保存形式との互換用。 */
  taxMarker?: string;
  categoryName?: string;
  quantity?: number;
  unitPriceYen?: number;
  warnings: string[];
  [key: string]: unknown;
};

export type ExtractedTaxSummary = {
  taxRatePercent: TaxRatePercent;
  taxMode: TaxMode;
  taxableAmountYen: number;
  taxableAmountBasis: AmountBasis;
  taxYen: number;
  taxIncludedAmountYen?: number;
  roundingMethod: RoundingMethod;
  confidence: Record<string, number | undefined>;
  warnings: string[];
  [key: string]: unknown;
};

export type TaxResolutionSource =
  | "item_explicit"
  | "single_summary"
  | "summary_reconciliation"
  | "remaining_summary"
  | "marker_reconciled";

export type TaxContextResolution =
  | {
      status: "resolved";
      taxRatePercent: TaxRatePercent;
      amountBasis: ResolvedAmountBasis;
      source: TaxResolutionSource;
    }
  | {
      status: "unresolved";
      taxRatePercent: TaxRatePercent | null;
      amountBasis: AmountBasis;
      reasons: string[];
    };

export type InterpretedReceiptItem = ExtractedReceiptItem & {
  taxContext: TaxContextResolution;
  allocatedTaxYen: number;
  normalizedAmountYen: number;
};

export type ReceiptTaxInput = {
  amountYen: number;
  items: ExtractedReceiptItem[];
  taxSummaries: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
};

export type ReceiptTaxInterpretation = {
  items: InterpretedReceiptItem[];
  taxSummaries: ExtractedTaxSummary[];
  warnings: string[];
};

export type TaxEvidence =
  | {
      type: "tax_summary";
      taxRatePercent: TaxRatePercent;
      taxableAmountYen: number;
      amountBasis: AmountBasis;
    }
  | { type: "item_explicit_rate"; itemIndex: number; taxRatePercent: TaxRatePercent }
  | {
      type: "marker_legend";
      itemIndex: number;
      marker: string;
      description: string;
      interpretedTaxRatePercent?: TaxRatePercent;
    };

export type ReconciliationResult = {
  taxSummaries: ExtractedTaxSummary[];
  duplicateWarnings: string[];
};

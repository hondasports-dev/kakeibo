import type { Id } from "../../../../convex/_generated/dataModel";

export type AiExpenseQueueStatus =
  | "adding"
  | "queued"
  | "analyzing"
  | "ready"
  | "needs_review"
  | "failed"
  | "registering"
  | "registered";

export type AiExpenseQueueDocumentType = "receipt" | "convenience_payment" | "unknown";

export type AiExpenseQueueItem = {
  id: string;
  fileName?: string;
  status: AiExpenseQueueStatus;
  documentType: AiExpenseQueueDocumentType;
  title?: string;
  amountYen?: number;
  date?: string;
  categoryName?: string;
  reviewReasons?: string[];
  itemTotalYen?: number;
  itemDifferenceYen?: number;
  hasUncategorizedItems?: boolean;
  hasLowConfidenceItems?: boolean;
  categoryAggregates?: Array<{
    categoryId: string;
    categoryName?: string;
    amountYen: number;
  }>;
};

export type QueueSectionKey = "processing" | "ready" | "needs_review" | "failed" | "registered";

export type AiExpenseQueueCategory = {
  _id: Id<"categories"> | string;
  name: string;
  color: string;
};

export type AiExpenseQueuePanelProps = {
  initialItems?: AiExpenseQueueItem[];
  categories?: AiExpenseQueueCategory[];
  initialReviewDrafts?: Record<string, AiExpenseDraft>;
  initialReviewDraftItems?: Record<string, AiExpenseDraftItem[]>;
  onReviewSubmit?: (
    draftId: string,
    values: {
      documentType: AiExpenseQueueDocumentType;
      shopName: string;
      date: string;
      amountYen: number;
      categoryId: string;
      items?: Array<{
        itemName: string;
        amountYen: number;
        categoryId: string;
      }>;
    },
    registerAfterUpdate: boolean,
  ) => Promise<void> | void;
};

export type AiExpenseDraftStatus = "ready" | "needs_review" | "failed" | "registered";

export type AiExpenseDraft = {
  _id: string;
  status: AiExpenseDraftStatus;
  documentType: AiExpenseQueueDocumentType;
  imageFileName?: string;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  categoryId?: string;
  reviewReasons: string[];
  warnings?: string[];
  itemSummary?: {
    itemTotalYen: number;
    itemDifferenceYen?: number;
    hasUncategorizedItems: boolean;
    hasLowConfidenceItems: boolean;
    categoryAggregates: Array<{
      categoryId: string;
      amountYen: number;
    }>;
  };
};

export type AiExpenseItemTaxDetails = {
  printedAmountYen?: number;
  amountBasis?: "tax_included" | "tax_excluded" | "unknown";
  taxRatePercent?: 0 | 8 | 10 | null;
  markers?: string[];
  taxMarker?: string;
  allocatedTaxYen?: number;
  normalizedAmountYen?: number;
  quantity?: number;
  unitPriceYen?: number;
};

export type AiExpenseDraftItem = AiExpenseItemTaxDetails & {
  _id?: string;
  itemName: string;
  amountYen: number;
  categoryName?: string;
  categoryId?: string;
  confidence?: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
  warnings?: string[];
};

export type AiExpenseDraftWithItems = {
  draft: AiExpenseDraft;
  items: AiExpenseDraftItem[];
};

export type ReviewFormValues = {
  documentType: AiExpenseQueueDocumentType;
  shopName: string;
  date: string;
  amountYen: string;
  categoryId: string;
};

export type ReviewItemValues = AiExpenseItemTaxDetails & {
  id: string;
  itemName: string;
  amountYen: string;
  categoryId: string;
  usesReceiptCategory?: boolean;
  discountTargetItemId?: string;
  confidence?: AiExpenseDraftItem["confidence"];
  warnings?: string[];
};

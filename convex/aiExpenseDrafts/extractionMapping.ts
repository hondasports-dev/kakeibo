import type { Doc } from "../_generated/dataModel";
import { buildCategoryCandidates, resolveCategoryIdFromCandidates } from "../categories/candidate";
import type { ExtractReceiptFieldsResult } from "../receiptImageExtraction/extraction";
import type { CreateFromExtractionArgs } from "./internal";
import { normalizeReceiptAmounts } from "../../lib/convex/receiptImageExtraction/taxNormalization";

export function mapExtractionToDraftArgs(
  extracted: ExtractReceiptFieldsResult,
  categories: Doc<"categories">[],
  imageFileName?: string,
): CreateFromExtractionArgs {
  const candidates = buildCategoryCandidates({
    documentType: extracted.documentType,
    categoryName: extracted.categoryName,
    shopName: extracted.shopName || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    categories,
  });
  const categoryId = resolveCategoryIdFromCandidates(extracted.categoryName, candidates);
  const normalization =
    extracted.items && extracted.items.length > 0 && extracted.taxSummaries
      ? normalizeReceiptAmounts({
          amountYen: extracted.amountYen,
          items: extracted.items.map((item) => ({
            itemName: item.itemName,
            printedAmountYen: item.printedAmountYen ?? item.amountYen,
            amountBasis: item.amountBasis ?? "tax_included",
            taxRatePercent: item.taxRatePercent ?? null,
            taxMarker: item.taxMarker ?? "",
            categoryName: item.categoryName,
            quantity: item.quantity,
            unitPriceYen: item.unitPriceYen,
            warnings: item.warnings,
          })),
          taxSummaries: extracted.taxSummaries,
        })
      : undefined;
  const items = extracted.items?.map((item, index) => {
    const normalized = normalization?.items[index];
    const itemCandidates = buildCategoryCandidates({
      documentType: extracted.documentType,
      categoryName: item.categoryName,
      shopName: item.itemName,
      categories,
    });
    const itemCategoryId = resolveCategoryIdFromCandidates(item.categoryName, itemCandidates);
    return {
      itemName: item.itemName,
      amountYen: normalized?.normalizedAmountYen ?? item.amountYen,
      printedAmountYen: normalized?.printedAmountYen ?? item.printedAmountYen,
      amountBasis: normalized?.amountBasis ?? item.amountBasis,
      taxRatePercent: normalized?.taxRatePercent ?? item.taxRatePercent,
      taxMarker: normalized?.taxMarker ?? item.taxMarker,
      allocatedTaxYen: normalized?.allocatedTaxYen,
      normalizedAmountYen: normalized?.normalizedAmountYen,
      quantity: normalized?.quantity ?? item.quantity,
      unitPriceYen: normalized?.unitPriceYen ?? item.unitPriceYen,
      categoryName: item.categoryName,
      categoryId: itemCategoryId,
      confidence: {
        itemName: item.confidence.itemName,
        amountYen: item.confidence.amountYen,
        categoryName: item.confidence.categoryName,
        categoryId: item.confidence.categoryName,
      },
      warnings: normalized?.warnings ?? item.warnings,
    };
  });

  return {
    documentType: extracted.documentType,
    shopName: extracted.shopName || undefined,
    paymentPlace: extracted.paymentPlace || undefined,
    payeeName: extracted.payeeName || undefined,
    paymentPurpose: extracted.paymentPurpose || undefined,
    date: extracted.date || undefined,
    amountYen: extracted.amountYen > 0 ? extracted.amountYen : undefined,
    taxSummaries: extracted.taxSummaries,
    categoryId,
    imageFileName,
    confidence: {
      documentType: extracted.confidence.documentType,
      shopName: extracted.confidence.shopName,
      paymentPlace: extracted.confidence.paymentPlace,
      payeeName: extracted.confidence.payeeName,
      paymentPurpose: extracted.confidence.paymentPurpose,
      date: extracted.confidence.date,
      amountYen: extracted.confidence.amountYen,
      categoryId: extracted.confidence.categoryName,
    },
    warnings: [...extracted.warnings, ...(normalization?.warnings ?? [])],
    reviewReasons: normalization?.warnings.length ? ["amount_mismatch"] : undefined,
    items,
  };
}

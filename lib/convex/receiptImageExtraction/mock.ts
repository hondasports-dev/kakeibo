import { ConvexError } from "convex/values";
import type { ExtractReceiptFieldsResult } from "./types";
import { JAPAN_TIME_ZONE } from "./types";

function getTodayDateStringInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new ConvexError("mock 日付の生成に失敗しました");
  }
  return `${year}-${month}-${day}`;
}

/** mock モード用のダミーレスポンス */
export function getMockResult(): ExtractReceiptFieldsResult {
  return {
    shopName: "サンプルストア",
    date: getTodayDateStringInJapan(),
    amountYen: 1234,
    documentType: "receipt",
    categoryName: "食費",
    items: [
      {
        itemName: "サンプル食品",
        amountYen: 734,
        printedAmountYen: 734,
        amountBasis: "tax_included",
        taxRatePercent: 10,
        markers: [],
        taxMarker: "",
        quantity: 1,
        unitPriceYen: 734,
        categoryName: "食費",
        confidence: {
          itemName: 0.92,
          amountYen: 0.96,
          printedAmountYen: 0.96,
          amountBasis: 0.9,
          taxRatePercent: 0.9,
          categoryName: 0.86,
        },
        warnings: [],
      },
      {
        itemName: "サンプル日用品",
        amountYen: 500,
        printedAmountYen: 500,
        amountBasis: "tax_included",
        taxRatePercent: 10,
        markers: [],
        taxMarker: "",
        quantity: 1,
        unitPriceYen: 500,
        categoryName: "日用品",
        confidence: {
          itemName: 0.88,
          amountYen: 0.95,
          printedAmountYen: 0.95,
          amountBasis: 0.9,
          taxRatePercent: 0.9,
          categoryName: 0.82,
        },
        warnings: [],
      },
    ],
    taxSummaries: [
      {
        taxRatePercent: 10,
        taxMode: "included",
        taxableAmountYen: 1234,
        taxableAmountBasis: "tax_included",
        taxYen: 112,
        taxIncludedAmountYen: 1234,
        roundingMethod: "floor",
        confidence: {
          taxRatePercent: 0.9,
          taxMode: 0.9,
          taxableAmountYen: 0.9,
          taxableAmountBasis: 0.9,
          taxYen: 0.9,
        },
        warnings: [],
      },
    ],
    markerDefinitions: [],
    confidence: {
      shopName: 0.95,
      date: 0.98,
      amountYen: 0.98,
      documentType: 0.9,
      categoryName: 0.85,
    },
    warnings: [],
  };
}

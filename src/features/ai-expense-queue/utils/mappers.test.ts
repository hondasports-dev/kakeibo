import { describe, expect, it } from "vitest";
import { mapDraftItemsToReviewItems, mapDraftToQueueItem } from "./mappers";

describe("mapDraftToQueueItem", () => {
  it("統合済みの払込票は店名・内容を一覧タイトルに使う", () => {
    const item = mapDraftToQueueItem(
      {
        _id: "draft-payment",
        status: "ready",
        documentType: "convenience_payment",
        shopName: "大阪市水道局 水道料金",
        reviewReasons: [],
      },
      {},
    );

    expect(item.title).toBe("大阪市水道局 水道料金");
  });

  it("明細サマリーのカテゴリ名・差額・確認フラグをキュー表示用に写す", () => {
    const item = mapDraftToQueueItem(
      {
        _id: "draft-mixed-receipt",
        status: "ready",
        documentType: "receipt",
        shopName: "ドラッグストアA",
        amountYen: 1500,
        categoryId: "cat-daily",
        reviewReasons: [],
        itemSummary: {
          itemTotalYen: 1380,
          itemDifferenceYen: 120,
          hasUncategorizedItems: true,
          hasLowConfidenceItems: true,
          categoryAggregates: [
            { categoryId: "cat-food", amountYen: 400 },
            { categoryId: "cat-medical", amountYen: 980 },
          ],
        },
      },
      {},
      [
        { _id: "cat-daily", name: "日用品" },
        { _id: "cat-food", name: "食費" },
        { _id: "cat-medical", name: "医療費" },
      ],
    );

    expect(item).toMatchObject({
      id: "draft-mixed-receipt",
      title: "ドラッグストアA",
      categoryName: "日用品",
      itemTotalYen: 1380,
      itemDifferenceYen: 120,
      hasUncategorizedItems: true,
      hasLowConfidenceItems: true,
      categoryAggregates: [
        { categoryId: "cat-food", categoryName: "食費", amountYen: 400 },
        { categoryId: "cat-medical", categoryName: "医療費", amountYen: 980 },
      ],
    });
  });
});

describe("mapDraftItemsToReviewItems", () => {
  it("外税確定の明細は印字金額を編集用金額にする", () => {
    const [item] = mapDraftItemsToReviewItems([
      {
        _id: "item-1",
        itemName: "たまご",
        amountYen: 322,
        printedAmountYen: 298,
        amountBasis: "tax_excluded",
        taxRatePercent: 8,
        allocatedTaxYen: 24,
        normalizedAmountYen: 322,
        taxResolutionStatus: "resolved",
        categoryId: "cat-food",
      },
    ]);

    expect(item).toMatchObject({
      amountYen: "298",
      printedAmountYen: 298,
      amountBasis: "tax_excluded",
      taxRatePercent: 8,
      allocatedTaxYen: 24,
      normalizedAmountYen: 322,
    });
  });

  it("内税確定の明細は登録用金額を編集用金額にする", () => {
    const [item] = mapDraftItemsToReviewItems([
      {
        _id: "item-1",
        itemName: "パン",
        amountYen: 108,
        printedAmountYen: 108,
        amountBasis: "tax_included",
        taxRatePercent: 8,
        normalizedAmountYen: 108,
        taxResolutionStatus: "resolved",
        categoryId: "cat-food",
      },
    ]);

    expect(item.amountYen).toBe("108");
  });

  it("税未確定の明細は印字金額を編集用金額にする", () => {
    const [item] = mapDraftItemsToReviewItems([
      {
        _id: "item-1",
        itemName: "E2E税テスト商品",
        amountYen: 108,
        printedAmountYen: 99,
        normalizedAmountYen: 108,
        taxResolutionStatus: "unresolved",
        categoryId: "cat-food",
      },
    ]);

    expect(item.amountYen).toBe("99");
  });
});

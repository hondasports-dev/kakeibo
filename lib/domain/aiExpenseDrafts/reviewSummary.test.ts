import { describe, expect, it } from "vitest";
import {
  computeReviewCategoryAggregates,
  computeReviewItemTotalYen,
  getReviewAttentionLabels,
  hasReviewLowConfidenceItems,
  hasReviewUncategorizedItems,
  type ReviewSummaryCategoryInput,
  type ReviewSummaryItemInput,
} from "./reviewSummary";

const categories: ReviewSummaryCategoryInput[] = [
  { _id: "cat-food", name: "食費" },
  { _id: "cat-medical", name: "医療費" },
];

describe("computeReviewItemTotalYen", () => {
  it("明細金額の合計を返す", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "パン", amountYen: "150", categoryId: "cat-food" },
      { itemName: "牛乳", amountYen: "250", categoryId: "cat-food" },
    ];
    expect(computeReviewItemTotalYen(items)).toBe(400);
  });

  it("空配列は 0 を返す", () => {
    expect(computeReviewItemTotalYen([])).toBe(0);
  });

  it("不正な金額は 0 として扱う", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "不明", amountYen: "abc", categoryId: "cat-food" },
    ];
    expect(computeReviewItemTotalYen(items)).toBe(0);
  });
});

describe("hasReviewUncategorizedItems", () => {
  it("categoryId が空の明細を未分類と判定する", () => {
    expect(
      hasReviewUncategorizedItems([{ itemName: "パン", amountYen: "150", categoryId: "" }]),
    ).toBe(true);
  });

  it("すべての明細に categoryId がある場合は false", () => {
    expect(
      hasReviewUncategorizedItems([{ itemName: "パン", amountYen: "150", categoryId: "cat-food" }]),
    ).toBe(false);
  });
});

describe("hasReviewLowConfidenceItems", () => {
  it("スコアが閾値未満の項目を低信頼度と判定する", () => {
    expect(
      hasReviewLowConfidenceItems([
        {
          itemName: "胃薬",
          amountYen: "980",
          categoryId: "cat-medical",
          confidence: { categoryName: 0.5 },
        },
      ]),
    ).toBe(true);
  });

  it("信頼度情報がなければ低信頼度としない", () => {
    expect(
      hasReviewLowConfidenceItems([
        { itemName: "胃薬", amountYen: "980", categoryId: "cat-medical" },
      ]),
    ).toBe(false);
  });
});

describe("computeReviewCategoryAggregates", () => {
  it("明細をカテゴリ別に集約する", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "パン", amountYen: "150", categoryId: "cat-food" },
      { itemName: "牛乳", amountYen: "250", categoryId: "cat-food" },
      { itemName: "胃薬", amountYen: "980", categoryId: "cat-medical" },
    ];

    expect(computeReviewCategoryAggregates(items, categories)).toEqual([
      { categoryId: "cat-food", categoryName: "食費", amountYen: 400 },
      { categoryId: "cat-medical", categoryName: "医療費", amountYen: 980 },
    ]);
  });

  it("未分類明細は集約対象に含めない", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "パン", amountYen: "150", categoryId: "cat-food" },
      { itemName: "不明", amountYen: "100", categoryId: "" },
    ];

    expect(computeReviewCategoryAggregates(items, categories)).toEqual([
      { categoryId: "cat-food", categoryName: "食費", amountYen: 150 },
    ]);
  });

  it("割引明細を同一カテゴリの正味額へ集約する", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "キュレル", amountYen: "1100", categoryId: "cat-medical" },
      { itemName: "クーポン券割引", amountYen: "-110", categoryId: "cat-medical" },
    ];

    expect(computeReviewCategoryAggregates(items, categories)).toEqual([
      { categoryId: "cat-medical", categoryName: "医療費", amountYen: 990 },
    ]);
  });

  it("対応するカテゴリがない場合は既定の名前を返す", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "パン", amountYen: "150", categoryId: "cat-unknown" },
    ];

    expect(computeReviewCategoryAggregates(items, categories)).toEqual([
      { categoryId: "cat-unknown", categoryName: "カテゴリ", amountYen: 150 },
    ]);
  });
});

describe("getReviewAttentionLabels", () => {
  it("未分類・低信頼度・差額のラベルを返す", () => {
    const items: ReviewSummaryItemInput[] = [
      {
        itemName: "胃薬",
        amountYen: "980",
        categoryId: "",
        confidence: { categoryName: 0.5 },
      },
    ];

    expect(getReviewAttentionLabels({ receiptAmountYen: 1380, reviewItems: items })).toEqual([
      "未分類の明細があります",
      "低信頼度の明細があります",
      "明細合計と合計金額に差額があります",
    ]);
  });

  it("明細が空なら差額ラベルを返さない", () => {
    expect(getReviewAttentionLabels({ receiptAmountYen: 1000, reviewItems: [] })).toEqual([]);
  });

  it("金額が一致すれば差額ラベルを返さない", () => {
    const items: ReviewSummaryItemInput[] = [
      { itemName: "パン", amountYen: "400", categoryId: "cat-food" },
    ];
    expect(getReviewAttentionLabels({ receiptAmountYen: 400, reviewItems: items })).toEqual([]);
  });
});

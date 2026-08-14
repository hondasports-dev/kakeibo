import { describe, expect, it } from "vitest";
import { getQueueContentSummary, getReviewPriority, type QueueItemSummary } from "./queue";

function makeItem(
  overrides: Partial<QueueItemSummary> & Pick<QueueItemSummary, "id">,
): QueueItemSummary {
  return {
    reviewReasons: [],
    itemDifferenceYen: 0,
    hasUncategorizedItems: false,
    ...overrides,
  };
}

const emptyGrouped = {
  processing: [] as QueueItemSummary[],
  ready: [] as QueueItemSummary[],
  needs_review: [] as QueueItemSummary[],
  failed: [] as QueueItemSummary[],
  registered: [] as QueueItemSummary[],
};

describe("getReviewPriority", () => {
  it("金額不一致(amount_mismatch) があれば最優先（0）", () => {
    expect(getReviewPriority(makeItem({ id: "1", reviewReasons: ["amount_mismatch"] }))).toBe(0);
  });

  it("itemDifferenceYen が 0 でなければ最優先（0）", () => {
    expect(getReviewPriority(makeItem({ id: "1", itemDifferenceYen: 1 }))).toBe(0);
    expect(getReviewPriority(makeItem({ id: "2", itemDifferenceYen: -100 }))).toBe(0);
  });

  it("amount_mismatch と itemDifferenceYen=0 の両方がある場合も 0", () => {
    expect(
      getReviewPriority(
        makeItem({ id: "1", reviewReasons: ["amount_mismatch"], itemDifferenceYen: 0 }),
      ),
    ).toBe(0);
  });

  it("未分類(ambiguous_category) なら 1", () => {
    expect(getReviewPriority(makeItem({ id: "1", reviewReasons: ["ambiguous_category"] }))).toBe(1);
  });

  it("hasUncategorizedItems が true なら 1", () => {
    expect(getReviewPriority(makeItem({ id: "1", hasUncategorizedItems: true }))).toBe(1);
  });

  it("優先度 0 より 1 が混在する場合は 0 が先", () => {
    expect(
      getReviewPriority(
        makeItem({ id: "1", reviewReasons: ["amount_mismatch", "ambiguous_category"] }),
      ),
    ).toBe(0);
  });

  it("該当理由がなければ 2", () => {
    expect(getReviewPriority(makeItem({ id: "1" }))).toBe(2);
    expect(getReviewPriority(makeItem({ id: "2", reviewReasons: ["low_confidence"] }))).toBe(2);
  });

  it("itemDifferenceYen=0 は優先度に影響しない", () => {
    expect(getReviewPriority(makeItem({ id: "1", itemDifferenceYen: 0 }))).toBe(2);
  });
});

describe("getQueueContentSummary", () => {
  it("空の状態で全カウント 0、firstReviewItem は undefined", () => {
    const result = getQueueContentSummary({
      groupedItems: emptyGrouped,
      readyItems: [],
      selectedReadyIds: [],
    });
    expect(result.failedCount).toBe(0);
    expect(result.processingCount).toBe(0);
    expect(result.needsReviewCount).toBe(0);
    expect(result.prioritizedReviewItems).toEqual([]);
    expect(result.firstReviewItem).toBeUndefined();
    expect(result.selectedTotalAmountYen).toBe(0);
  });

  it("needs_review を reviewPriority 順にソートする", () => {
    const itemHigh = makeItem({ id: "low", reviewReasons: ["low_confidence"] });
    const itemAmount = makeItem({ id: "amount", itemDifferenceYen: 10 });
    const itemCategory = makeItem({ id: "category", hasUncategorizedItems: true });
    const grouped = { ...emptyGrouped, needs_review: [itemHigh, itemCategory, itemAmount] };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems: [],
      selectedReadyIds: [],
    });

    expect(result.prioritizedReviewItems.map((item) => item.id)).toEqual([
      "amount",
      "category",
      "low",
    ]);
    expect(result.firstReviewItem?.id).toBe("amount");
  });

  it("選択された ready アイテムの合計金額を計算する", () => {
    const readyItems = [
      makeItem({ id: "a", amountYen: 1000 }),
      makeItem({ id: "b", amountYen: 2500 }),
      makeItem({ id: "c" }),
    ];
    const grouped = { ...emptyGrouped, ready: readyItems };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems,
      selectedReadyIds: ["a", "c"],
    });

    expect(result.selectedTotalAmountYen).toBe(1000);
  });

  it("選択IDが readyItems に存在しない場合は無視する", () => {
    const readyItems = [makeItem({ id: "a", amountYen: 1000 })];
    const grouped = { ...emptyGrouped, ready: readyItems };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems,
      selectedReadyIds: ["a", "missing"],
    });

    expect(result.selectedTotalAmountYen).toBe(1000);
  });

  it("amountYen が undefined のアイテムは合計に 0 として扱う", () => {
    const readyItems = [makeItem({ id: "a" })];
    const grouped = { ...emptyGrouped, ready: readyItems };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems,
      selectedReadyIds: ["a"],
    });

    expect(result.selectedTotalAmountYen).toBe(0);
  });

  it("全セクションの件数を返す", () => {
    const grouped = {
      processing: [makeItem({ id: "p1" })],
      ready: [makeItem({ id: "r1" })],
      needs_review: [makeItem({ id: "nr1" })],
      failed: [makeItem({ id: "f1" })],
      registered: [makeItem({ id: "reg1" })],
    };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems: grouped.ready,
      selectedReadyIds: [],
    });

    expect(result.processingCount).toBe(1);
    expect(result.needsReviewCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.prioritizedReviewItems.map((i) => i.id)).toEqual(["nr1"]);
  });

  it("selectedReadyIds が空なら合計は 0", () => {
    const readyItems = [makeItem({ id: "a", amountYen: 1000 })];
    const grouped = { ...emptyGrouped, ready: readyItems };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems,
      selectedReadyIds: [],
    });

    expect(result.selectedTotalAmountYen).toBe(0);
  });

  it("負の金額も合計に含む", () => {
    const readyItems = [makeItem({ id: "a", amountYen: -500 })];
    const grouped = { ...emptyGrouped, ready: readyItems };

    const result = getQueueContentSummary({
      groupedItems: grouped,
      readyItems,
      selectedReadyIds: ["a"],
    });

    expect(result.selectedTotalAmountYen).toBe(-500);
  });
});

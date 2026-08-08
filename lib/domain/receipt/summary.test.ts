import { describe, expect, it } from "vitest";
import { summarizeByCategory, summarizeReceipts } from "./summary";

describe("summarizeReceipts", () => {
  it("件数と合計金額を返す", () => {
    expect(summarizeReceipts([{ amountYen: 100 }, { amountYen: 250 }]).totalAmountYen).toBe(350);
    expect(summarizeReceipts([{ amountYen: 100 }, { amountYen: 250 }]).count).toBe(2);
  });

  it("空配列は 0 になる", () => {
    expect(summarizeReceipts([])).toEqual({ count: 0, totalAmountYen: 0 });
  });
});

describe("summarizeByCategory", () => {
  const info = new Map<string, { name: string; color: string }>([
    ["cat1", { name: "食費", color: "#FF0000" }],
    ["cat2", { name: "交通費", color: "#00FF00" }],
  ]);

  it("カテゴリごとに集計して金額降順に並べる", () => {
    const result = summarizeByCategory(
      [
        { categoryId: "cat1", amountYen: 500 },
        { categoryId: "cat2", amountYen: 1200 },
        { categoryId: "cat1", amountYen: 300 },
      ],
      info,
    );
    expect(result).toEqual([
      {
        categoryId: "cat2",
        categoryName: "交通費",
        categoryColor: "#00FF00",
        totalAmountYen: 1200,
        count: 1,
      },
      {
        categoryId: "cat1",
        categoryName: "食費",
        categoryColor: "#FF0000",
        totalAmountYen: 800,
        count: 2,
      },
    ]);
  });

  it("カテゴリ情報が未登録の場合は 不明 / デフォルト色 を使う", () => {
    const result = summarizeByCategory([{ categoryId: "unknown", amountYen: 100 }], info);
    expect(result[0]).toMatchObject({
      categoryName: "不明",
      categoryColor: "#AAB7C4",
      totalAmountYen: 100,
      count: 1,
    });
  });
});

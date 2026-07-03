import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { aggregateDraftItemsByCategory } from "./reviewValidation";

const categoryId = "cat-food" as Id<"categories">;
const draft = {
  amountYen: 1683,
  categoryId,
  shopName: "TRIAL",
} as Doc<"aiExpenseDrafts">;

function draftItem(values: { itemName: string; amountYen: number; normalizedAmountYen?: number }) {
  return {
    ...values,
    categoryId,
    confidence: { itemName: 1, amountYen: 1, categoryId: 1 },
  } as Doc<"aiExpenseDraftItems">;
}

describe("aggregateDraftItemsByCategory tax amounts", () => {
  it("新形式ではnormalizedAmountYenを登録用金額に使う", () => {
    const result = aggregateDraftItemsByCategory(draft, [
      draftItem({ itemName: "商品A", amountYen: 1000, normalizedAmountYen: 1080 }),
      draftItem({ itemName: "商品B", amountYen: 559, normalizedAmountYen: 603 }),
    ]);
    expect(result).toEqual([{ itemName: "TRIAL", amountYen: 1683, categoryId }]);
  });

  it("旧形式ではamountYenへfallbackする", () => {
    const result = aggregateDraftItemsByCategory(
      { ...draft, amountYen: 1559 } as Doc<"aiExpenseDrafts">,
      [
        draftItem({ itemName: "商品A", amountYen: 1000 }),
        draftItem({ itemName: "商品B", amountYen: 559 }),
      ],
    );
    expect(result[0].amountYen).toBe(1559);
  });

  it("normalized合計が支払合計と不一致なら登録を拒否する", () => {
    expect(() =>
      aggregateDraftItemsByCategory(draft, [
        draftItem({ itemName: "商品A", amountYen: 1000, normalizedAmountYen: 1000 }),
      ]),
    ).toThrow("Draft item total must match draft amount");
  });
});

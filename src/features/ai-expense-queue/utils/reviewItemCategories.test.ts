import { describe, expect, it } from "vitest";
import type { ReviewItemValues } from "../types/types";
import {
  applyReceiptCategory,
  assignCategoryToItems,
  assignDiscountTarget,
  initializeReviewCategoryState,
  prepareReviewItemsForSubmit,
} from "./reviewItemCategories";

const receiptItems: ReviewItemValues[] = [
  { id: "tobacco", itemName: "キャメル・メンソール", amountYen: "1060", categoryId: "" },
  { id: "food", itemName: "マルちゃん ごつ盛", amountYen: "139", categoryId: "" },
  { id: "daily", itemName: "キュレル ジェルメイク", amountYen: "1100", categoryId: "" },
  {
    id: "discount",
    itemName: "クーポン券割引 10%",
    amountYen: "-110",
    categoryId: "",
  },
];

describe("reviewItemCategories", () => {
  it("単一カテゴリでは通常明細すべてへレシート全体カテゴリを適用する", () => {
    const items = applyReceiptCategory(receiptItems, "cat-daily");

    expect(items.slice(0, 3).map((item) => item.categoryId)).toEqual([
      "cat-daily",
      "cat-daily",
      "cat-daily",
    ]);
    expect(items[3].categoryId).toBe("");
  });

  it("選択した通常明細だけ別カテゴリへ変更する", () => {
    const initialized = applyReceiptCategory(receiptItems, "cat-daily");
    const items = assignCategoryToItems(initialized, ["food"], "cat-food");

    expect(items.find((item) => item.id === "food")).toMatchObject({
      categoryId: "cat-food",
      usesReceiptCategory: false,
    });
    expect(items.find((item) => item.id === "daily")).toMatchObject({
      categoryId: "cat-daily",
      usesReceiptCategory: true,
    });
  });

  it("割引対象の商品を選ぶと同じカテゴリへ帰属し、対象商品の変更にも追従する", () => {
    const split = assignCategoryToItems(
      applyReceiptCategory(receiptItems, "cat-other"),
      ["daily"],
      "cat-daily",
    );
    const targeted = assignDiscountTarget(split, "discount", "daily");
    const reassigned = assignCategoryToItems(targeted, ["daily"], "cat-medical");

    expect(reassigned.find((item) => item.id === "discount")).toMatchObject({
      categoryId: "cat-medical",
      discountTargetItemId: "daily",
    });
  });

  it("既存カテゴリが複数なら分割状態、単一なら全体カテゴリ状態で初期化する", () => {
    const mixed = initializeReviewCategoryState(
      [
        { ...receiptItems[0], categoryId: "cat-other" },
        { ...receiptItems[1], categoryId: "cat-food" },
        { ...receiptItems[2], categoryId: "" },
      ],
      "cat-other",
    );
    const single = initializeReviewCategoryState(
      receiptItems.slice(0, 2).map((item) => ({ ...item, categoryId: "cat-food" })),
      "cat-food",
    );

    expect(mixed.isCategorySplit).toBe(true);
    expect(mixed.items[2]).toMatchObject({
      categoryId: "cat-other",
      usesReceiptCategory: true,
    });
    expect(single.isCategorySplit).toBe(false);
    expect(single.items.every((item) => item.usesReceiptCategory)).toBe(true);
  });

  it("全商品が同一カテゴリならレシート推定より明細カテゴリを優先して単一表示にする", () => {
    const initialized = initializeReviewCategoryState(
      receiptItems.slice(0, 2).map((item) => ({ ...item, categoryId: "cat-food" })),
      "cat-daily",
    );

    expect(initialized.isCategorySplit).toBe(false);
    expect(initialized.receiptCategoryId).toBe("cat-food");
    expect(initialized.items.every((item) => item.usesReceiptCategory)).toBe(true);
  });

  it("既知カテゴリと未分類が混在し全体カテゴリも異なる場合は分割表示にする", () => {
    const initialized = initializeReviewCategoryState(
      [
        { ...receiptItems[0], categoryId: "cat-food" },
        { ...receiptItems[1], categoryId: "" },
      ],
      "cat-daily",
    );

    expect(initialized.isCategorySplit).toBe(true);
    expect(initialized.items[0]).toMatchObject({
      categoryId: "cat-food",
      usesReceiptCategory: false,
    });
    expect(initialized.items[1]).toMatchObject({
      categoryId: "cat-daily",
      usesReceiptCategory: true,
    });
  });

  it("送信前に全体カテゴリと個別指定を最終categoryIdへ展開する", () => {
    const split = assignCategoryToItems(
      applyReceiptCategory(receiptItems, "cat-other"),
      ["food", "daily"],
      "cat-food",
    );
    const targeted = assignDiscountTarget(split, "discount", "daily");
    const submitted = prepareReviewItemsForSubmit(targeted, "cat-other");

    expect(submitted.map(({ id, categoryId }) => ({ id, categoryId }))).toEqual([
      { id: "tobacco", categoryId: "cat-other" },
      { id: "food", categoryId: "cat-food" },
      { id: "daily", categoryId: "cat-food" },
      { id: "discount", categoryId: "cat-food" },
    ]);
  });
});

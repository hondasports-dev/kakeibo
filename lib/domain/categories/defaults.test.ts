import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORIES,
  MAX_CATEGORIES_PER_GROUP,
  shouldRefreshLegacyDefaultCategoryColor,
} from "./defaults";

describe("DEFAULT_CATEGORIES", () => {
  it("デフォルトカテゴリが 8 件あり、sortOrder が 1 から連続している", () => {
    expect(DEFAULT_CATEGORIES.length).toBe(8);
    DEFAULT_CATEGORIES.forEach((category, index) => {
      expect(category.sortOrder).toBe(index + 1);
    });
  });
});

describe("MAX_CATEGORIES_PER_GROUP", () => {
  it("100 である", () => {
    expect(MAX_CATEGORIES_PER_GROUP).toBe(100);
  });
});

describe("shouldRefreshLegacyDefaultCategoryColor", () => {
  it("名前・sortOrder が一致し、color が legacy カラーなら true", () => {
    const existing = { name: "食費", color: "#FF6B6B", sortOrder: 1 };
    expect(shouldRefreshLegacyDefaultCategoryColor(existing, DEFAULT_CATEGORIES[0])).toBe(true);
  });

  it("color が現在のデフォルトと同じなら false", () => {
    const existing = { name: "食費", color: "#8B5E3C", sortOrder: 1 };
    expect(shouldRefreshLegacyDefaultCategoryColor(existing, DEFAULT_CATEGORIES[0])).toBe(false);
  });

  it("名前が異なるなら false", () => {
    const existing = { name: "食品", color: "#FF6B6B", sortOrder: 1 };
    expect(shouldRefreshLegacyDefaultCategoryColor(existing, DEFAULT_CATEGORIES[0])).toBe(false);
  });
});

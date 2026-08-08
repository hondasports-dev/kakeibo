import { describe, expect, it } from "vitest";
import {
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryColor,
  normalizeCategoryDescription,
  normalizeCategoryName,
} from "./normalize";

describe("normalizeCategoryName", () => {
  it("空白を trim して正規化する", () => {
    expect(normalizeCategoryName("  食費  ")).toBe("食費");
  });

  it("空文字列を拒否する", () => {
    expect(() => normalizeCategoryName("")).toThrow("Category name is required");
    expect(() => normalizeCategoryName("   ")).toThrow("Category name is required");
  });

  it("最大文字数を超える場合は拒否する", () => {
    const longName = "a".repeat(MAX_CATEGORY_NAME_LENGTH + 1);
    expect(() => normalizeCategoryName(longName)).toThrow(
      `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`,
    );
  });

  it("最大文字数の名前は受け入れる", () => {
    const name = "a".repeat(MAX_CATEGORY_NAME_LENGTH);
    expect(normalizeCategoryName(name)).toBe(name);
  });
});

describe("normalizeCategoryColor", () => {
  it("有効な hex カラーを大文字に正規化する", () => {
    expect(normalizeCategoryColor("#ff5733")).toBe("#FF5733");
  });

  it("無効なカラーを拒否する", () => {
    expect(() => normalizeCategoryColor("red")).toThrow("Category color must be a hex color");
    expect(() => normalizeCategoryColor("#fff")).toThrow("Category color must be a hex color");
  });
});

describe("normalizeCategoryDescription", () => {
  it("undefined を受け入れる", () => {
    expect(normalizeCategoryDescription(undefined)).toBeUndefined();
  });

  it("空白説明を受け入れる", () => {
    expect(normalizeCategoryDescription("  ")).toBe("  ");
  });

  it("最大文字数を超える場合は拒否する", () => {
    const longDescription = "a".repeat(201);
    expect(() => normalizeCategoryDescription(longDescription)).toThrow(
      "Category description must be 200 characters or fewer",
    );
  });
});

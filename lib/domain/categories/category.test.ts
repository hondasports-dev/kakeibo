import { describe, expect, it } from "vitest";
import {
  MAX_CATEGORY_DESCRIPTION_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  validateCategoryColor,
  validateCategoryDescription,
  validateCategoryName,
} from "./category";

describe("category constants", () => {
  it("カテゴリ名・説明の最大長が期待通り", () => {
    expect(MAX_CATEGORY_NAME_LENGTH).toBe(40);
    expect(MAX_CATEGORY_DESCRIPTION_LENGTH).toBe(200);
  });
});

describe("validateCategoryName", () => {
  it("前後の空白を trim して成功する", () => {
    const result = validateCategoryName(" 食費 ");
    expect(result).toEqual({ success: true, name: "食費" });
  });

  it("空文字は empty", () => {
    const result = validateCategoryName("   ");
    expect(result).toEqual({ success: false, error: "empty" });
  });

  it("最大長を超える場合は too_long", () => {
    const result = validateCategoryName("a".repeat(MAX_CATEGORY_NAME_LENGTH + 1));
    expect(result).toEqual({ success: false, error: "too_long" });
  });
});

describe("validateCategoryColor", () => {
  it.each(["#8B5E3C", "#aab7c4"])("%s は有効な hex カラー", (color) => {
    const result = validateCategoryColor(color);
    expect(result).toEqual({ success: true, color: color.toUpperCase() });
  });

  it.each(["", "red", "#12345", "#1234567", "#GGGHHH"])("%s は無効な hex カラー", (color) => {
    const result = validateCategoryColor(color);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("invalid_hex");
    }
  });
});

describe("validateCategoryDescription", () => {
  it("undefined は有効", () => {
    expect(validateCategoryDescription(undefined)).toEqual({
      success: true,
      description: undefined,
    });
  });

  it("最大長を超える場合は too_long", () => {
    const result = validateCategoryDescription("a".repeat(MAX_CATEGORY_DESCRIPTION_LENGTH + 1));
    expect(result).toEqual({ success: false, error: "too_long" });
  });
});

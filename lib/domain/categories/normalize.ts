import {
  MAX_CATEGORY_DESCRIPTION_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  validateCategoryColor,
  validateCategoryDescription,
  validateCategoryName,
} from "./category";

export { MAX_CATEGORY_DESCRIPTION_LENGTH, MAX_CATEGORY_NAME_LENGTH } from "./category";

/**
 * カテゴリ名を trim して正規化する。不正な場合は Error を投げる。
 */
export function normalizeCategoryName(name: string): string {
  const result = validateCategoryName(name);
  if (!result.success) {
    if (result.error === "empty") {
      throw new Error("Category name is required");
    }
    throw new Error(`Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`);
  }
  return result.name;
}

/**
 * カテゴリカラーを hex 値として正規化する。不正な場合は Error を投げる。
 */
export function normalizeCategoryColor(color: string): string {
  const result = validateCategoryColor(color);
  if (!result.success) {
    throw new Error("Category color must be a hex color");
  }
  return result.color;
}

/**
 * カテゴリ説明を正規化する。不正な場合は Error を投げる。
 */
export function normalizeCategoryDescription(description?: string): string | undefined {
  const result = validateCategoryDescription(description);
  if (!result.success) {
    throw new Error(
      `Category description must be ${MAX_CATEGORY_DESCRIPTION_LENGTH} characters or fewer`,
    );
  }
  return result.description;
}

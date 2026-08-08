import { ConvexError } from "convex/values";
import {
  MAX_CATEGORY_DESCRIPTION_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryColor as normalizeCategoryColorDomain,
  normalizeCategoryDescription as normalizeCategoryDescriptionDomain,
  normalizeCategoryName as normalizeCategoryNameDomain,
} from "../../lib/domain/categories/normalize";

export { MAX_CATEGORY_DESCRIPTION_LENGTH, MAX_CATEGORY_NAME_LENGTH };

export function normalizeCategoryName(name: string): string {
  try {
    return normalizeCategoryNameDomain(name);
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid category name");
  }
}

export function normalizeCategoryColor(color: string): string {
  try {
    return normalizeCategoryColorDomain(color);
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid category color");
  }
}

export function normalizeCategoryDescription(description?: string): string | undefined {
  try {
    return normalizeCategoryDescriptionDomain(description);
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid category description");
  }
}

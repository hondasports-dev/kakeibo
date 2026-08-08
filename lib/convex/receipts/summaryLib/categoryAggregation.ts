import type { QueryCtx } from "../../../../convex/_generated/server";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
export {
  summarizeByCategory,
  summarizeReceipts,
  type CategorySummary,
} from "../../../domain/receipt/summary";

export async function buildCategoryInfoMap(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  categoryIds: string[],
): Promise<Map<string, { name: string; color: string }>> {
  const categories = (await Promise.all(
    categoryIds.map((categoryId) => ctx.db.get(categoryId as Id<"categories">)),
  )) as Array<Doc<"categories"> | null>;

  const categoryInfoMap = new Map<string, { name: string; color: string }>();
  for (const category of categories) {
    if (category === null || category.groupId !== groupId) {
      continue;
    }
    categoryInfoMap.set(category._id as string, {
      name: category.name,
      color: category.color,
    });
  }

  return categoryInfoMap;
}

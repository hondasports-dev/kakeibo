import type { QueryCtx } from "../../../../convex/_generated/server";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

export function summarizeReceipts(receipts: Array<{ amountYen: number }>) {
  const count = receipts.length;
  const totalAmountYen = receipts.reduce((sum, r) => sum + r.amountYen, 0);
  return { count, totalAmountYen };
}

export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmountYen: number;
  count: number;
};

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

export function summarizeByCategory(
  receipts: Array<{ categoryId: string; amountYen: number }>,
  categoryInfoMap: Map<string, { name: string; color: string }>,
): CategorySummary[] {
  const categoryMap = new Map<
    string,
    { name: string; color: string; total: number; count: number }
  >();

  for (const receipt of receipts) {
    const categoryIdStr = receipt.categoryId as string;
    const info = categoryInfoMap.get(categoryIdStr);
    const name = info?.name ?? "不明";
    const color = info?.color ?? "#AAB7C4";

    const catEntry = categoryMap.get(categoryIdStr);
    if (catEntry === undefined) {
      categoryMap.set(categoryIdStr, { name, color, total: receipt.amountYen, count: 1 });
    } else {
      catEntry.total += receipt.amountYen;
      catEntry.count += 1;
    }
  }

  return Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      categoryColor: data.color,
      totalAmountYen: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.totalAmountYen - a.totalAmountYen);
}

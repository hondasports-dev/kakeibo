import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import { getMonthAggregationEntries } from "../../../../convex/receipts/spendingEntries";
import { ConvexError } from "convex/values";
import { getMonthStartDate } from "../../../domain/common/month";
import { getYearMonths, normalizeYear } from "../../../domain/common/year";
import { summarizeYearlyTrend, type YearlySummary } from "../../../domain/receipt/yearlySummary";
import { buildCategoryInfoMap } from "./categoryAggregation";

export type { YearlySummary } from "../../../domain/receipt/yearlySummary";

type GetYearSummaryArgs = {
  year: string;
};

export async function getYearSummaryHandler(
  ctx: QueryCtx,
  args: GetYearSummaryArgs,
): Promise<YearlySummary> {
  const year = normalizeYear(args.year);
  if (year === null) {
    throw new ConvexError("Invalid year");
  }

  const { groupId } = await requireGroupMembership(ctx);
  const months = getYearMonths(year);
  const monthSources = await Promise.all(
    months.map(async (month) => {
      const entries = await getMonthAggregationEntries(ctx, groupId, getMonthStartDate(month));
      return { month, expenses: entries.expenses, incomes: entries.incomes };
    }),
  );
  const categoryIds = new Set<string>();
  for (const source of monthSources) {
    for (const expense of source.expenses) {
      categoryIds.add(expense.categoryId);
    }
  }

  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, Array.from(categoryIds));
  return summarizeYearlyTrend({
    year,
    months: monthSources,
    categoryInfoMap,
  });
}

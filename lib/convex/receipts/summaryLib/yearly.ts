import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import {
  getMonthIncomeEntries,
  getMonthSpendingEntries,
} from "../../../../convex/receipts/spendingEntries";
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
  const monthSources = [];
  const categoryIds = new Set<string>();

  for (const month of months) {
    const monthStartDate = getMonthStartDate(month);
    const expenses = await getMonthSpendingEntries(ctx, groupId, monthStartDate);
    const incomes = await getMonthIncomeEntries(ctx, groupId, monthStartDate);
    for (const expense of expenses) {
      categoryIds.add(expense.categoryId);
    }
    monthSources.push({ month, expenses, incomes });
  }

  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, Array.from(categoryIds));
  return summarizeYearlyTrend({
    year,
    months: monthSources,
    categoryInfoMap,
  });
}

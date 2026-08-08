import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import { getMonthSpendingEntries } from "../../../../convex/receipts/spendingEntries";
import {
  summarizeMonthlyExpenses,
  type MonthlyExpensesSummary,
} from "../../../domain/receipt/monthlySummary";

export { type MonthlyExpensesSummary } from "../../../domain/receipt/monthlySummary";

type GetMonthlyExpensesSummaryArgs = {
  monthStartDate: string;
};

/** getMonthlyExpensesSummary query の handler ロジック（テスト用に export） */
export async function getMonthlyExpensesSummaryHandler(
  ctx: QueryCtx,
  args: GetMonthlyExpensesSummaryArgs,
): Promise<MonthlyExpensesSummary> {
  // groupId はレシートクエリに、userId は users テーブルの monthlyIncome 取得に使う
  const { groupId, userId } = await requireGroupMembership(ctx);

  const monthlyReceipts = await getMonthSpendingEntries(ctx, groupId, args.monthStartDate);

  // users テーブルから monthlyIncome を取得する
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  return summarizeMonthlyExpenses(monthlyReceipts, user?.monthlyIncome);
}

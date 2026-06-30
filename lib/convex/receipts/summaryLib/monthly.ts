import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import { getMonthSpendingEntries } from "../../../../convex/receipts/spendingEntries";

export type MonthlyExpensesSummary = {
  totalExpensesYen: number;
  monthlyIncome: number | null;
  remainingBalanceYen: number | null;
};

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
  const totalExpensesYen = monthlyReceipts.reduce((sum, r) => sum + r.amountYen, 0);

  // users テーブルから monthlyIncome を取得する
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  const monthlyIncome = user?.monthlyIncome ?? null;
  const remainingBalanceYen = monthlyIncome !== null ? monthlyIncome - totalExpensesYen : null;

  return {
    totalExpensesYen,
    monthlyIncome,
    remainingBalanceYen,
  };
}

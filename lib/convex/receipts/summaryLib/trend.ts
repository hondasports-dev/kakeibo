import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import { calculateRelativeWeekStartDate } from "../../../../convex/lib/weekDates";
import { addDays, getDateSpendingEntries } from "../../../../convex/receipts/spendingEntries";

export type DailySpendingTrendData = {
  currentWeek: Array<{
    date: string;
    totalAmountYen: number;
  }>;
  previousWeek: Array<{
    date: string;
    totalAmountYen: number;
  }>;
};

type GetDailySpendingTrendArgs = {
  weekStartDate: string;
};

/** getDailySpendingTrend query の handler ロジック（テスト用に export） */
export async function getDailySpendingTrendHandler(
  ctx: QueryCtx,
  args: GetDailySpendingTrendArgs,
): Promise<DailySpendingTrendData> {
  const { groupId } = await requireGroupMembership(ctx);

  async function getTotalForDate(targetDate: string): Promise<number> {
    const receipts = await getDateSpendingEntries(ctx, groupId, targetDate);
    return receipts.reduce((sum, r) => sum + r.amountYen, 0);
  }

  const currentWeekStart = args.weekStartDate;
  const previousWeekStart = calculateRelativeWeekStartDate(args.weekStartDate, -1);

  const currentWeek: DailySpendingTrendData["currentWeek"] = [];
  const previousWeek: DailySpendingTrendData["previousWeek"] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(currentWeekStart, i);
    const previousDate = addDays(previousWeekStart, i);
    currentWeek.push({ date: currentDate, totalAmountYen: await getTotalForDate(currentDate) });
    previousWeek.push({ date: previousDate, totalAmountYen: await getTotalForDate(previousDate) });
  }

  return { currentWeek, previousWeek };
}

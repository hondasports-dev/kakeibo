import type { QueryCtx } from "../_generated/server";
import { normalizeWeekStartDay } from "../lib/weekDates";

/** ユーザー設定から週開始曜日を取得する。未保存の場合は月曜日始まりにする。 */
export async function getWeeklyStartDayForUser(ctx: QueryCtx, userId: string): Promise<number> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  return normalizeWeekStartDay(user?.weeklyStartDay);
}

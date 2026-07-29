import type { QueryCtx } from "../../../convex/_generated/server";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { addDays } from "../dateUtils";

type GetReceiptsByWeekArgs = {
  weekStartDate: string;
};

/** getReceiptsByWeek query の handler ロジック（テスト用に export） */
export async function getReceiptsByWeekHandler(ctx: QueryCtx, args: GetReceiptsByWeekArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const weekEndDate = addDays(args.weekStartDate, 6);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", args.weekStartDate).lte("date", weekEndDate),
    )
    .order("desc")
    .take(200);
}

type GetReceiptsByDateArgs = {
  date: string;
};

/** getReceiptsByDate query の handler ロジック（テスト用に export） */
export async function getReceiptsByDateHandler(ctx: QueryCtx, args: GetReceiptsByDateArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", args.date))
    .take(50);
}

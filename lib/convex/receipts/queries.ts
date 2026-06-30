import type { QueryCtx } from "../../../convex/_generated/server";
import { requireGroupMembership } from "../../../convex/groups/membership";

type GetReceiptsByWeekArgs = {
  weekStartDate: string;
};

/** getReceiptsByWeek query の handler ロジック（テスト用に export） */
export async function getReceiptsByWeekHandler(ctx: QueryCtx, args: GetReceiptsByWeekArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
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

import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireGroupMembership } from "../groups/membership";

/** getWeekSession query の handler ロジック（テスト用に export） */
export async function getWeekSessionHandler(ctx: QueryCtx, args: { weekStartDate: string }) {
  const { groupId } = await requireGroupMembership(ctx);

  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  return session;
}

export const getWeekSession = query({
  args: { weekStartDate: v.string() },
  handler: getWeekSessionHandler,
});

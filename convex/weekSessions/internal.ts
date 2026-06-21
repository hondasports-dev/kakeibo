import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";

export async function resetWeekSessionForUserHandler(
  ctx: MutationCtx,
  { groupId, weekStartDate }: { groupId: Id<"groups">; weekStartDate: string },
) {
  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", weekStartDate),
    )
    .unique();

  if (session === null) {
    return { reset: false };
  }

  await ctx.db.patch(session._id, {
    status: "draft",
    reviewMemo: undefined,
    updatedAt: Date.now(),
  });

  return { reset: true };
}

/**
 * 指定グループ・指定週の週次セッションを draft に戻す。
 *
 * この mutation は internalMutation として定義されており、外部クライアントから
 * 直接呼び出せない。E2E テスト用の HTTP エンドポイント（convex/http.ts）経由でのみ呼び出す。
 */
export const resetWeekSessionForUser = internalMutation({
  args: {
    groupId: v.id("groups"),
    weekStartDate: v.string(),
  },
  handler: resetWeekSessionForUserHandler,
});

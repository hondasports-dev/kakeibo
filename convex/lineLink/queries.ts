import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUserId } from "../users/auth";

export const getStatus = query({
  args: {},
  returns: v.union(
    v.object({ status: v.literal("unlinked") }),
    v.object({ status: v.literal("linked"), linkedAt: v.number() }),
  ),
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const activeLink = await ctx.db
      .query("lineAccountLinks")
      .withIndex("by_user_id_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .unique();

    // LINE userIdはクライアントへ返さない。
    return activeLink
      ? { status: "linked" as const, linkedAt: activeLink.linkedAt }
      : { status: "unlinked" as const };
  },
});

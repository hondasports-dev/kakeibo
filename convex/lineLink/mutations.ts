import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUserId } from "../users/auth";

export const unlink = mutation({
  args: {},
  returns: v.object({ status: v.literal("unlinked") }),
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const activeLink = await ctx.db
      .query("lineAccountLinks")
      .withIndex("by_user_id_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .unique();
    if (!activeLink) return { status: "unlinked" as const };

    const now = Date.now();
    await ctx.db.patch(activeLink._id, { status: "revoked", revokedAt: now, updatedAt: now });
    await ctx.db.insert("lineLinkAuditLogs", {
      userId,
      action: "unlinked",
      result: "success",
      createdAt: now,
    });
    return { status: "unlinked" as const };
  },
});

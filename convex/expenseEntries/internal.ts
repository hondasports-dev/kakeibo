import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const deleteE2eExpenseEntriesByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
    userId: v.string(),
  },
  handler: async (ctx, { groupId, userId }) => {
    let totalDeleted = 0;

    while (true) {
      const entries = await ctx.db
        .query("expenseEntries")
        .withIndex("by_group_id_and_created_by_user_id", (q) =>
          q.eq("groupId", groupId).eq("createdByUserId", userId),
        )
        .take(500);

      if (entries.length === 0) {
        break;
      }

      await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)));
      totalDeleted += entries.length;
    }

    return { deletedCount: totalDeleted };
  },
});

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const deleteE2eExpenseEntriesByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, { groupId }) => {
    const entries = await ctx.db
      .query("expenseEntries")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
      .take(500);

    await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)));
    return { deletedCount: entries.length };
  },
});

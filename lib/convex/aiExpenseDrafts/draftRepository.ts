import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";

export async function deleteDraftAndItems(
  ctx: Pick<MutationCtx, "db">,
  draftId: Id<"aiExpenseDrafts">,
  groupId: Id<"groups">,
) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.groupId !== groupId || draft.status === "registered") {
    return;
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId).eq("draftId", draftId))
    .collect();
  await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  await ctx.db.delete(draftId);
}

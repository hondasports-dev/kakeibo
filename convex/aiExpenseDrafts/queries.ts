import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups";

const LIST_LIMIT = 100;

type AiExpenseDraftStatus =
  | "queued"
  | "analyzing"
  | "ready"
  | "needs_review"
  | "failed"
  | "registered";

type ListByStatusArgs = {
  status: AiExpenseDraftStatus;
};

type GetWithItemsArgs = {
  draftId: Id<"aiExpenseDrafts">;
};

export async function listByStatusHandler(ctx: QueryCtx, args: ListByStatusArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  return await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_group_id_and_status_and_created_at", (q) =>
      q.eq("groupId", groupId).eq("status", args.status),
    )
    .order("desc")
    .take(LIST_LIMIT);
}

export async function getWithItemsHandler(ctx: QueryCtx, args: GetWithItemsArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    return null;
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .take(LIST_LIMIT);

  return { draft, items };
}

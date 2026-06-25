import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD, aiExpenseDraftStatusValidator } from "./model";
import { requireGroupMembership } from "../groups/membership";

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

function hasLowConfidenceItem(item: {
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
}) {
  return (
    (item.confidence.itemName ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.amountYen ?? 1) < AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD ||
    (item.confidence.categoryId ?? item.confidence.categoryName ?? 1) <
      AI_EXPENSE_DRAFT_CONFIDENCE_THRESHOLD
  );
}

function summarizeItems(
  draft: { amountYen?: number },
  items: Array<{
    amountYen: number;
    categoryId?: Id<"categories">;
    confidence: {
      itemName?: number;
      amountYen?: number;
      categoryName?: number;
      categoryId?: number;
    };
  }>,
) {
  if (items.length === 0) {
    return undefined;
  }

  const categoryAmounts = new Map<Id<"categories">, number>();
  let itemTotalYen = 0;
  let hasUncategorizedItems = false;
  let hasLowConfidenceItems = false;

  for (const item of items) {
    itemTotalYen += item.amountYen;
    if (item.categoryId === undefined) {
      hasUncategorizedItems = true;
    } else {
      categoryAmounts.set(
        item.categoryId,
        (categoryAmounts.get(item.categoryId) ?? 0) + item.amountYen,
      );
    }
    if (hasLowConfidenceItem(item)) {
      hasLowConfidenceItems = true;
    }
  }

  return {
    itemTotalYen,
    itemDifferenceYen: draft.amountYen === undefined ? undefined : draft.amountYen - itemTotalYen,
    hasUncategorizedItems,
    hasLowConfidenceItems,
    categoryAggregates: Array.from(categoryAmounts.entries()).map(([categoryId, amountYen]) => ({
      categoryId,
      amountYen,
    })),
  };
}

export async function listByStatusHandler(ctx: QueryCtx, args: ListByStatusArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const drafts = await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_group_id_and_status_and_created_at", (q) =>
      q.eq("groupId", groupId).eq("status", args.status),
    )
    .order("desc")
    .take(LIST_LIMIT);

  if (args.status !== "ready" && args.status !== "needs_review") {
    return drafts;
  }

  return await Promise.all(
    drafts.map(async (draft) => {
      const items = await ctx.db
        .query("aiExpenseDraftItems")
        .withIndex("by_group_id_and_draft_id", (q) =>
          q.eq("groupId", groupId).eq("draftId", draft._id),
        )
        .order("asc")
        .take(LIST_LIMIT);
      return {
        ...draft,
        itemSummary: summarizeItems(draft, items),
      };
    }),
  );
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

export const listByStatus = query({
  args: {
    status: aiExpenseDraftStatusValidator,
  },
  handler: listByStatusHandler,
});

export const getWithItems = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getWithItemsHandler,
});

import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";

export type DeleteDraftsByUserBatchArgs = {
  groupId: Id<"groups">;
  limit?: number;
};

export type CreateE2eReadyDraftForUserArgs = {
  groupId: Id<"groups">;
  categoryId: Id<"categories">;
  secondaryCategoryId?: Id<"categories">;
};

async function insertDraftItems(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  draftId: Id<"aiExpenseDrafts">,
  items: Array<{
    itemName: string;
    amountYen: number;
    categoryId: Id<"categories">;
    confidence: {
      itemName?: number;
      amountYen?: number;
      categoryId?: number;
    };
  }>,
  now: number,
) {
  for (const item of items) {
    await ctx.db.insert("aiExpenseDraftItems", {
      groupId,
      draftId,
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
      confidence: item.confidence,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function deleteDraftsByUserBatchHandler(
  ctx: MutationCtx,
  args: DeleteDraftsByUserBatchArgs,
) {
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 100);
  const drafts = await ctx.db
    .query("aiExpenseDrafts")
    .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", args.groupId))
    .order("asc")
    .take(limit);

  let deletedDraftCount = 0;
  let deletedItemCount = 0;

  for (const draft of drafts) {
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", args.groupId).eq("draftId", draft._id),
      )
      .take(100);
    for (const item of items) {
      await ctx.db.delete(item._id);
      deletedItemCount += 1;
    }
    await ctx.db.delete(draft._id);
    deletedDraftCount += 1;
  }

  return {
    deletedDraftCount,
    deletedItemCount,
    hasMore: drafts.length === limit,
  };
}

export async function createE2eReadyDraftForUserHandler(
  ctx: MutationCtx,
  args: CreateE2eReadyDraftForUserArgs,
) {
  const now = Date.now();
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId: args.groupId,
    sourceType: "image_upload",
    status: "ready",
    documentType: "receipt",
    imageFileName: "e2e-issue-179-ready.png",
    shopName: "E2Eスーパー",
    date: "2026-06-01",
    amountYen: 1500,
    categoryId: args.categoryId,
    confidence: {
      documentType: 0.99,
      shopName: 0.99,
      date: 0.99,
      amountYen: 0.99,
      categoryId: 0.99,
    },
    warnings: [],
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
  });

  await insertDraftItems(
    ctx,
    args.groupId,
    draftId,
    [
      {
        itemName: "E2E項目-食料品",
        amountYen: 700,
        categoryId: args.categoryId,
        confidence: {
          itemName: 0.99,
          amountYen: 0.99,
          categoryId: 0.99,
        },
      },
      {
        itemName: "E2E項目-パン",
        amountYen: 300,
        categoryId: args.categoryId,
        confidence: {
          itemName: 0.99,
          amountYen: 0.99,
          categoryId: 0.99,
        },
      },
      {
        itemName: "E2E項目-日用品",
        amountYen: 500,
        categoryId: args.secondaryCategoryId ?? args.categoryId,
        confidence: {
          itemName: 0.99,
          amountYen: 0.99,
          categoryId: 0.99,
        },
      },
    ],
    now,
  );

  return draftId;
}

import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "../groups/membership";
import type { Id } from "../_generated/dataModel";

type ExpenseEntryItemArg = {
  categoryId: Id<"categories">;
  amountYen: number;
  title: string;
  memo?: string;
};

type CreateExpenseEntriesArgs = {
  date: string;
  sourceDocumentId?: Id<"sourceDocuments">;
  items: ExpenseEntryItemArg[];
};

export async function createExpenseEntriesHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateExpenseEntriesArgs,
): Promise<void> {
  const { groupId } = await requireGroupMembership(ctx);

  const now = Date.now();

  for (const item of args.items) {
    const category = await ctx.db.get(item.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.groupId !== groupId) {
      throw new ConvexError("Category does not belong to the current group");
    }
    if (!category.isActive) {
      throw new ConvexError("Inactive category cannot be used for new expense entries");
    }

    await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId: args.sourceDocumentId,
      date: args.date,
      amount: item.amountYen,
      categoryId: item.categoryId,
      title: item.title,
      memo: item.memo,
      entryType: "expense",
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const createExpenseEntries = mutation({
  args: {
    date: v.string(),
    sourceDocumentId: v.optional(v.id("sourceDocuments")),
    items: v.array(
      v.object({
        categoryId: v.id("categories"),
        amountYen: v.number(),
        title: v.string(),
        memo: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await createExpenseEntriesHandler(ctx, args);
  },
});

type DraftItemArg = {
  itemName?: string;
  amountYen: number;
  categoryId?: Id<"categories">;
};

type CreateExpenseEntriesFromDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
  items: DraftItemArg[];
};

export async function createExpenseEntriesFromDraftHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateExpenseEntriesFromDraftArgs,
): Promise<Id<"expenseEntries">[]> {
  const { groupId } = await requireGroupMembership(ctx);

  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("Draft not found");
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("Draft does not belong to the current group");
  }
  if (draft.status !== "ready") {
    throw new ConvexError("Only ready drafts can create expense entries");
  }
  if (!draft.date) {
    throw new ConvexError("Draft date is required");
  }

  const now = Date.now();
  const createdIds: Id<"expenseEntries">[] = [];

  for (const item of args.items) {
    const categoryId = item.categoryId ?? draft.categoryId;
    if (categoryId === undefined) {
      throw new ConvexError("Category ID is required");
    }

    const category = await ctx.db.get(categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.groupId !== groupId) {
      throw new ConvexError("Category does not belong to the current group");
    }
    if (!category.isActive) {
      throw new ConvexError("Inactive category cannot be used for new expense entries");
    }

    const entryId = await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId: undefined,
      aiExpenseDraftId: args.draftId,
      date: draft.date,
      amount: item.amountYen,
      categoryId,
      title: item.itemName ?? "不明",
      entryType: "expense",
      source: "ai_suggested",
      createdAt: now,
      updatedAt: now,
    });
    createdIds.push(entryId);
  }

  return createdIds;
}

export const createExpenseEntriesFromDraft = mutation({
  args: {
    draftId: v.id("aiExpenseDrafts"),
    items: v.array(
      v.object({
        itemName: v.optional(v.string()),
        amountYen: v.number(),
        categoryId: v.optional(v.id("categories")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await createExpenseEntriesFromDraftHandler(ctx, args);
  },
});

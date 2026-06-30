import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "../groups/membership";
import { isValidIsoDateString } from "../lib/weekDates";
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
    if (!Number.isInteger(item.amountYen) || item.amountYen <= 0) {
      throw new ConvexError("Amount must be a positive integer");
    }
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
    if (!Number.isInteger(item.amountYen) || item.amountYen <= 0) {
      throw new ConvexError("Amount must be a positive integer");
    }
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

type UpdateExpenseEntryArgs = {
  expenseEntryId: Id<"expenseEntries">;
  date?: string;
  amountYen?: number;
  categoryId?: Id<"categories">;
  title?: string;
  memo?: string;
};

export async function updateExpenseEntryHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: UpdateExpenseEntryArgs,
): Promise<Id<"expenseEntries">> {
  const { groupId } = await requireGroupMembership(ctx);

  const entry = await ctx.db.get(args.expenseEntryId);
  if (entry === null) {
    throw new ConvexError("Expense entry not found");
  }
  if (entry.groupId !== groupId) {
    throw new ConvexError("Expense entry does not belong to the current group");
  }

  if (args.amountYen !== undefined) {
    if (!Number.isInteger(args.amountYen) || args.amountYen <= 0) {
      throw new ConvexError("Amount must be a positive integer");
    }
  }

  if (args.categoryId !== undefined) {
    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.groupId !== groupId) {
      throw new ConvexError("Category does not belong to the current group");
    }
    if (!category.isActive && args.categoryId !== entry.categoryId) {
      throw new ConvexError("Inactive category cannot be used for expense entries");
    }
  }

  const now = Date.now();
  const patch: {
    date?: string;
    amount?: number;
    categoryId?: Id<"categories">;
    title?: string;
    memo?: string;
    updatedAt: number;
  } = { updatedAt: now };

  if (args.date !== undefined) {
    if (!args.date.trim() || !isValidIsoDateString(args.date)) {
      throw new ConvexError("Date must be a valid YYYY-MM-DD value");
    }
    patch.date = args.date;
  }
  if (args.amountYen !== undefined) {
    patch.amount = args.amountYen;
  }
  if (args.categoryId !== undefined) {
    patch.categoryId = args.categoryId;
  }
  if (args.title !== undefined) {
    patch.title = args.title;
  }
  if (args.memo !== undefined) {
    patch.memo = args.memo;
  }

  await ctx.db.patch(args.expenseEntryId, patch);
  return args.expenseEntryId;
}

export const updateExpenseEntry = mutation({
  args: {
    expenseEntryId: v.id("expenseEntries"),
    date: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    title: v.optional(v.string()),
    memo: v.optional(v.string()),
  },
  returns: v.id("expenseEntries"),
  handler: async (ctx, args) => {
    return await updateExpenseEntryHandler(ctx, args);
  },
});

type DeleteExpenseEntryArgs = {
  expenseEntryId: Id<"expenseEntries">;
};

export async function deleteExpenseEntryHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: DeleteExpenseEntryArgs,
): Promise<void> {
  const { groupId } = await requireGroupMembership(ctx);

  const entry = await ctx.db.get(args.expenseEntryId);
  if (entry === null) {
    throw new ConvexError("Expense entry not found");
  }
  if (entry.groupId !== groupId) {
    throw new ConvexError("Expense entry does not belong to the current group");
  }

  await ctx.db.delete(args.expenseEntryId);
}

export const deleteExpenseEntry = mutation({
  args: {
    expenseEntryId: v.id("expenseEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteExpenseEntryHandler(ctx, args);
    return null;
  },
});

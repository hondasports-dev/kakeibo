import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "../groups/membership";
import { isValidIsoDateString } from "../lib/weekDates";
import type { Id } from "../_generated/dataModel";
import { assertExpenseCategoryBelongsToGroup } from "../../lib/convex/expenseEntries/expenseEntryValidation";
import {
  createExpenseEntriesFromDraftHandler,
  type CreateExpenseEntriesFromDraftArgs,
} from "../../lib/convex/expenseEntries/createFromDraft";

type ExpenseEntryItemArg = {
  categoryId: Id<"categories">;
  amountYen: number;
  title: string;
  memo?: string;
};

type CreateExpenseEntriesArgs = {
  date: string;
  shopName?: string;
  sourceAmountYen?: number;
  sourceDocumentId?: Id<"sourceDocuments">;
  items: ExpenseEntryItemArg[];
};

type CreateIncomeEntryArgs = {
  date: string;
  amountYen: number;
  title: string;
};

export async function createIncomeEntryHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateIncomeEntryArgs,
): Promise<Id<"expenseEntries">> {
  const { groupId } = await requireGroupMembership(ctx);
  if (!args.date.trim() || !isValidIsoDateString(args.date)) {
    throw new ConvexError("Date must be a valid YYYY-MM-DD value");
  }
  if (!Number.isInteger(args.amountYen) || args.amountYen <= 0) {
    throw new ConvexError("Amount must be a positive integer");
  }
  const title = args.title.trim();
  if (!title) {
    throw new ConvexError("Income description is required");
  }
  const now = Date.now();
  return await ctx.db.insert("expenseEntries", {
    groupId,
    date: args.date,
    amount: args.amountYen,
    title,
    entryType: "income",
    source: "manual",
    createdAt: now,
    updatedAt: now,
  });
}

export const createIncomeEntry = mutation({
  args: { date: v.string(), amountYen: v.number(), title: v.string() },
  returns: v.id("expenseEntries"),
  handler: createIncomeEntryHandler,
});

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
    await assertExpenseCategoryBelongsToGroup(ctx, item.categoryId, groupId);
  }

  let sourceDocumentId = args.sourceDocumentId;

  if (sourceDocumentId === undefined && args.shopName?.trim()) {
    const itemsTotalAmountYen = args.items.reduce((sum, item) => sum + item.amountYen, 0);
    sourceDocumentId = await ctx.db.insert("sourceDocuments", {
      groupId,
      sourceType: "manual",
      status: "finalized",
      date: args.date,
      totalAmount: args.sourceAmountYen ?? itemsTotalAmountYen,
      shopName: args.shopName.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const item of args.items) {
    await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId,
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
    shopName: v.optional(v.string()),
    sourceAmountYen: v.optional(v.number()),
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

export { createExpenseEntriesFromDraftHandler, type CreateExpenseEntriesFromDraftArgs };

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
    await assertExpenseCategoryBelongsToGroup(ctx, args.categoryId, groupId, {
      inactiveErrorMessage: "Inactive category cannot be used for expense entries",
      allowInactiveWhenUnchangedFrom: entry.categoryId,
    });
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

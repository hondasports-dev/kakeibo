import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuthenticatedUserId } from "./users";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// createExpenseEntries
// ---------------------------------------------------------------------------

type ExpenseEntryItemArg = {
  categoryId: string;
  amountYen: number;
  title: string;
  memo?: string;
};

type CreateExpenseEntriesArgs = {
  date: string;
  sourceDocumentId?: string;
  items: ExpenseEntryItemArg[];
};

export async function createExpenseEntriesHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateExpenseEntriesArgs,
): Promise<void> {
  const userId = await requireAuthenticatedUserId(ctx);

  const now = Date.now();

  for (const item of args.items) {
    const category = await ctx.db.get(item.categoryId as Id<"categories">);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.userId !== userId) {
      throw new ConvexError("Category does not belong to the current user");
    }
    if (!category.isActive) {
      throw new ConvexError("Inactive category cannot be used for new expense entries");
    }

    await ctx.db.insert("expenseEntries", {
      userId,
      sourceDocumentId: args.sourceDocumentId
        ? (args.sourceDocumentId as Id<"sourceDocuments">)
        : undefined,
      date: args.date,
      amount: item.amountYen,
      categoryId: item.categoryId as Id<"categories">,
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
    sourceDocumentId: v.optional(v.string()),
    items: v.array(
      v.object({
        categoryId: v.string(),
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

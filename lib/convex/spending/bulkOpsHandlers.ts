import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { assertExpenseCategoryBelongsToGroup } from "../expenseEntries/expenseEntryValidation";
import { MAX_BULK_SPENDING_SELECTION, dedupeIds, isExpenseReceiptType } from "./bulkOps";

export type BulkSpendingIdArgs = {
  expenseEntryIds: Id<"expenseEntries">[];
  receiptIds: Id<"receipts">[];
};

export function normalizeBulkSpendingIds(args: BulkSpendingIdArgs): {
  expenseEntryIds: Id<"expenseEntries">[];
  receiptIds: Id<"receipts">[];
  totalCount: number;
} {
  const expenseEntryIds = dedupeIds(args.expenseEntryIds);
  const receiptIds = dedupeIds(args.receiptIds);
  const totalCount = expenseEntryIds.length + receiptIds.length;

  if (totalCount === 0) {
    throw new ConvexError("At least one spending record id is required");
  }
  if (totalCount > MAX_BULK_SPENDING_SELECTION) {
    throw new ConvexError(
      `At most ${MAX_BULK_SPENDING_SELECTION} spending records can be updated at once`,
    );
  }

  return { expenseEntryIds, receiptIds, totalCount };
}

async function loadValidatedExpenseEntries(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  expenseEntryIds: Id<"expenseEntries">[],
) {
  const entries = [];
  for (const expenseEntryId of expenseEntryIds) {
    const entry = await ctx.db.get(expenseEntryId);
    if (entry === null) {
      throw new ConvexError("Expense entry not found");
    }
    if (entry.groupId !== groupId) {
      throw new ConvexError("Expense entry does not belong to the current group");
    }
    if (entry.entryType === "income") {
      throw new ConvexError("Income records cannot be included in bulk spending operations");
    }
    entries.push(entry);
  }
  return entries;
}

async function loadValidatedExpenseReceipts(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  receiptIds: Id<"receipts">[],
) {
  const receipts = [];
  for (const receiptId of receiptIds) {
    const receipt = await ctx.db.get(receiptId);
    if (receipt === null) {
      throw new ConvexError("Receipt not found");
    }
    if (receipt.groupId !== groupId) {
      throw new ConvexError("Receipt does not belong to the current group");
    }
    if (!isExpenseReceiptType(receipt.type)) {
      throw new ConvexError("Income records cannot be included in bulk spending operations");
    }
    receipts.push(receipt);
  }
  return receipts;
}

export async function bulkUpdateSpendingCategoriesHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: BulkSpendingIdArgs & { categoryId: Id<"categories"> },
): Promise<{ updatedCount: number }> {
  const { groupId } = await requireGroupMembership(ctx);
  const { expenseEntryIds, receiptIds, totalCount } = normalizeBulkSpendingIds(args);

  await assertExpenseCategoryBelongsToGroup(ctx, args.categoryId, groupId, {
    inactiveErrorMessage: "Inactive category cannot be used for expense entries",
  });

  await loadValidatedExpenseEntries(ctx, groupId, expenseEntryIds);
  await loadValidatedExpenseReceipts(ctx, groupId, receiptIds);

  const now = Date.now();
  for (const expenseEntryId of expenseEntryIds) {
    await ctx.db.patch(expenseEntryId, {
      categoryId: args.categoryId,
      updatedAt: now,
    });
  }
  for (const receiptId of receiptIds) {
    await ctx.db.patch(receiptId, {
      categoryId: args.categoryId,
      updatedAt: now,
    });
  }

  return { updatedCount: totalCount };
}

export async function bulkDeleteSpendingRecordsHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: BulkSpendingIdArgs,
): Promise<{ deletedCount: number }> {
  const { groupId } = await requireGroupMembership(ctx);
  const { expenseEntryIds, receiptIds, totalCount } = normalizeBulkSpendingIds(args);

  await loadValidatedExpenseEntries(ctx, groupId, expenseEntryIds);
  await loadValidatedExpenseReceipts(ctx, groupId, receiptIds);

  for (const expenseEntryId of expenseEntryIds) {
    await ctx.db.delete(expenseEntryId);
  }
  for (const receiptId of receiptIds) {
    await ctx.db.delete(receiptId);
  }

  return { deletedCount: totalCount };
}

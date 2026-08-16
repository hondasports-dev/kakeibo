import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordManagementAuditLog } from "../../../convex/groups/lib/managementAuditLog";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { assertExpenseCategoryBelongsToGroup } from "../expenseEntries/expenseEntryValidation";
import { MAX_BULK_SPENDING_SELECTION, dedupeIds, isExpenseReceiptType } from "./bulkOps";
import {
  BULK_SPENDING_CATEGORY_CHANGED_ACTION,
  BULK_SPENDING_DELETED_ACTION,
  type BulkSpendingAuditRecord,
  buildBulkSpendingAuditSnapshot,
  formatBulkSpendingAuditTargetLabel,
} from "./bulkOpsAudit";

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

function toAuditRecords(
  entries: Array<{ _id: Id<"expenseEntries">; date?: string; categoryId?: Id<"categories"> }>,
  receipts: Array<{ _id: Id<"receipts">; date?: string; categoryId?: Id<"categories"> }>,
): BulkSpendingAuditRecord[] {
  return [
    ...entries.map((entry) => ({
      id: entry._id,
      kind: "expenseEntry" as const,
      date: entry.date ?? "",
      categoryId: entry.categoryId,
    })),
    ...receipts.map((receipt) => ({
      id: receipt._id,
      kind: "receipt" as const,
      date: receipt.date ?? "",
      categoryId: receipt.categoryId,
    })),
  ];
}

async function loadCategoryNamesById(
  ctx: Pick<MutationCtx, "db">,
  categoryIds: Array<string | undefined>,
): Promise<Map<string, string>> {
  const namesById = new Map<string, string>();
  for (const categoryId of [...new Set(categoryIds.filter((id): id is string => Boolean(id)))]) {
    const category = await ctx.db.get(categoryId as Id<"categories">);
    if (category && "name" in category && typeof category.name === "string") {
      namesById.set(categoryId, category.name);
    }
  }
  return namesById;
}

async function recordBulkSpendingAuditLog(
  ctx: Pick<MutationCtx, "db">,
  args: {
    groupId: Id<"groups">;
    actorUserId: string;
    action: typeof BULK_SPENDING_CATEGORY_CHANGED_ACTION | typeof BULK_SPENDING_DELETED_ACTION;
    records: BulkSpendingAuditRecord[];
    nextCategory?: { categoryId: string; categoryName: string };
  },
) {
  const categoryNamesById = await loadCategoryNamesById(ctx, [
    ...args.records.map((record) => record.categoryId),
    args.nextCategory?.categoryId,
  ]);
  const snapshot = buildBulkSpendingAuditSnapshot(
    args.records,
    categoryNamesById,
    args.nextCategory,
  );

  await recordManagementAuditLog(ctx, {
    groupId: args.groupId,
    actorUserId: args.actorUserId,
    action: args.action,
    targetKind: "group",
    targetId: args.groupId,
    targetLabel: formatBulkSpendingAuditTargetLabel(snapshot, args.action),
    afterValue: JSON.stringify(snapshot),
  });
}

export async function bulkUpdateSpendingCategoriesHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: BulkSpendingIdArgs & { categoryId: Id<"categories"> },
): Promise<{ updatedCount: number }> {
  const { groupId, userId } = await requireGroupMembership(ctx);
  const { expenseEntryIds, receiptIds, totalCount } = normalizeBulkSpendingIds(args);

  const nextCategory = await assertExpenseCategoryBelongsToGroup(ctx, args.categoryId, groupId, {
    inactiveErrorMessage: "Inactive category cannot be used for expense entries",
  });

  const entries = await loadValidatedExpenseEntries(ctx, groupId, expenseEntryIds);
  const receipts = await loadValidatedExpenseReceipts(ctx, groupId, receiptIds);

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

  await recordBulkSpendingAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: BULK_SPENDING_CATEGORY_CHANGED_ACTION,
    records: toAuditRecords(entries, receipts),
    nextCategory: {
      categoryId: args.categoryId,
      categoryName: nextCategory.name,
    },
  });

  return { updatedCount: totalCount };
}

export async function bulkDeleteSpendingRecordsHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: BulkSpendingIdArgs,
): Promise<{ deletedCount: number }> {
  const { groupId, userId } = await requireGroupMembership(ctx);
  const { expenseEntryIds, receiptIds, totalCount } = normalizeBulkSpendingIds(args);

  const entries = await loadValidatedExpenseEntries(ctx, groupId, expenseEntryIds);
  const receipts = await loadValidatedExpenseReceipts(ctx, groupId, receiptIds);

  for (const expenseEntryId of expenseEntryIds) {
    await ctx.db.delete(expenseEntryId);
  }
  for (const receiptId of receiptIds) {
    await ctx.db.delete(receiptId);
  }

  await recordBulkSpendingAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: BULK_SPENDING_DELETED_ACTION,
    records: toAuditRecords(entries, receipts),
  });

  return { deletedCount: totalCount };
}

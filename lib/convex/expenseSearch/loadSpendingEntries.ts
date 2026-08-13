import type { QueryCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  addLegacyReceiptGroups,
  enrichSpendingEntriesWithReceiptGroups,
  mapExpenseEntriesToReceiptLinkages,
  mapReceiptToSpendingEntry,
  type SpendingEntry,
} from "../receipts/spendingEntries";

export const SEARCH_SCAN_LIMIT = 1_000;

async function fetchExpenseEntriesForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<{ entries: Doc<"expenseEntries">[]; truncated: boolean }> {
  const entries = await ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) => {
      if (startDate !== undefined && endDate !== undefined) {
        return q.eq("groupId", groupId).gte("date", startDate).lte("date", endDate);
      }
      if (startDate !== undefined) {
        return q.eq("groupId", groupId).gte("date", startDate);
      }
      if (endDate !== undefined) {
        return q.eq("groupId", groupId).lte("date", endDate);
      }
      return q.eq("groupId", groupId);
    })
    .order("desc")
    .take(SEARCH_SCAN_LIMIT + 1);

  return {
    entries: entries.slice(0, SEARCH_SCAN_LIMIT),
    truncated: entries.length > SEARCH_SCAN_LIMIT,
  };
}

async function fetchReceiptsForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<{ receipts: Doc<"receipts">[]; truncated: boolean }> {
  const receipts = await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => {
      if (startDate !== undefined && endDate !== undefined) {
        return q.eq("groupId", groupId).gte("date", startDate).lte("date", endDate);
      }
      if (startDate !== undefined) {
        return q.eq("groupId", groupId).gte("date", startDate);
      }
      if (endDate !== undefined) {
        return q.eq("groupId", groupId).lte("date", endDate);
      }
      return q.eq("groupId", groupId);
    })
    .order("desc")
    .take(SEARCH_SCAN_LIMIT + 1);

  return {
    receipts: receipts.slice(0, SEARCH_SCAN_LIMIT),
    truncated: receipts.length > SEARCH_SCAN_LIMIT,
  };
}

export async function loadSpendingEntriesForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<{ entries: SpendingEntry[]; truncated: boolean }> {
  const { entries, truncated } = await fetchExpenseEntriesForSearch(
    ctx,
    groupId,
    startDate,
    endDate,
  );
  const expenseEntries = entries.filter((entry) => entry.entryType !== "income");

  if (expenseEntries.length > 0) {
    return {
      entries: await enrichSpendingEntriesWithReceiptGroups(
        ctx,
        groupId,
        mapExpenseEntriesToReceiptLinkages(expenseEntries),
      ),
      truncated,
    };
  }

  if (entries.length > 0) {
    return { entries: [], truncated };
  }

  const { receipts, truncated: receiptsTruncated } = await fetchReceiptsForSearch(
    ctx,
    groupId,
    startDate,
    endDate,
  );

  return {
    entries: addLegacyReceiptGroups(
      receipts
        .filter((receipt) => receipt.type !== "income")
        .map((receipt) => mapReceiptToSpendingEntry(receipt)),
    ),
    truncated: receiptsTruncated,
  };
}

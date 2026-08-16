import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import {
  addLegacyReceiptGroups,
  enrichSpendingEntriesWithReceiptGroups,
  mapExpenseEntriesToReceiptLinkages,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
  type IncomeListEntry,
  type SpendingEntry,
} from "../receipts/spendingEntries";

export const SEARCH_MAX_RECORDS = 10_000;

// Convexの1実行では複数の独立queryをpaginateできないため、支出・収入の
// 複数sourceを結合する検索は各sourceを有限件数で読み、domain側のkeyset cursorで続きから返す。
// unboundedなcollectは行わず、上限超過はUIへtruncatedとして伝える。

type SearchDocsResult<T> = {
  docs: T[];
  truncated: boolean;
};

function groupDocsByMonth<T extends { date: string }>(docs: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const doc of docs) {
    const month = doc.date.slice(0, 7);
    const bucket = grouped.get(month);
    if (bucket === undefined) {
      grouped.set(month, [doc]);
    } else {
      bucket.push(doc);
    }
  }
  return grouped;
}

async function fetchExpenseEntriesForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<SearchDocsResult<Doc<"expenseEntries">>> {
  const query = ctx.db
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
    .order("desc");

  const docs = await query.take(SEARCH_MAX_RECORDS + 1);
  return {
    docs: docs.slice(0, SEARCH_MAX_RECORDS),
    truncated: docs.length > SEARCH_MAX_RECORDS,
  };
}

async function fetchReceiptsForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<SearchDocsResult<Doc<"receipts">>> {
  const query = ctx.db
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
    .order("desc");

  const docs = await query.take(SEARCH_MAX_RECORDS + 1);
  return {
    docs: docs.slice(0, SEARCH_MAX_RECORDS),
    truncated: docs.length > SEARCH_MAX_RECORDS,
  };
}

export type SearchHistoryEntries = {
  entries: SpendingEntry[];
  incomes: IncomeListEntry[];
  truncated: boolean;
};

export async function loadHistoryEntriesForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<SearchHistoryEntries> {
  const [newEntryResult, receiptResult] = await Promise.all([
    fetchExpenseEntriesForSearch(ctx, groupId, startDate, endDate),
    fetchReceiptsForSearch(ctx, groupId, startDate, endDate),
  ]);
  const newEntries = newEntryResult.docs;
  const receipts = receiptResult.docs;

  // 旧形式との切替は検索範囲全体ではなく月単位で判定する。
  // 検索範囲に新形式が1件あるだけで、別月に残る旧形式まで落とすと、
  // 移行期間の履歴を欠落させてしまうため、集計側の互換ルールに合わせる。
  const newEntriesByMonth = groupDocsByMonth(newEntries);
  const receiptsByMonth = groupDocsByMonth(receipts);
  const months = Array.from(new Set([...newEntriesByMonth.keys(), ...receiptsByMonth.keys()])).sort(
    (left, right) => right.localeCompare(left),
  );
  const expenseEntriesToUse: Doc<"expenseEntries">[] = [];
  const legacyExpenseReceiptsToUse: Doc<"receipts">[] = [];
  const incomeEntriesToUse: Doc<"expenseEntries">[] = [];
  const legacyIncomeReceiptsToUse: Doc<"receipts">[] = [];

  for (const month of months) {
    const monthEntries = newEntriesByMonth.get(month) ?? [];
    const monthReceipts = receiptsByMonth.get(month) ?? [];
    const monthExpenseEntries = monthEntries.filter((entry) => entry.entryType === "expense");
    const monthIncomeEntries = monthEntries.filter((entry) => entry.entryType === "income");

    if (monthExpenseEntries.length > 0) {
      expenseEntriesToUse.push(...monthExpenseEntries);
    } else {
      legacyExpenseReceiptsToUse.push(
        ...monthReceipts.filter((receipt) => receipt.type !== "income"),
      );
    }

    if (monthIncomeEntries.length > 0) {
      incomeEntriesToUse.push(...monthIncomeEntries);
    } else {
      legacyIncomeReceiptsToUse.push(
        ...monthReceipts.filter((receipt) => receipt.type === "income"),
      );
    }
  }

  const enrichedEntries = await enrichSpendingEntriesWithReceiptGroups(
    ctx,
    groupId,
    mapExpenseEntriesToReceiptLinkages(expenseEntriesToUse),
  );
  const entries = [
    ...enrichedEntries,
    ...addLegacyReceiptGroups(
      legacyExpenseReceiptsToUse.map((receipt) => mapReceiptToSpendingEntry(receipt)),
    ),
  ];
  const incomes = [
    ...incomeEntriesToUse.map((entry) => mapIncomeExpenseEntryToListEntry(entry)),
    ...legacyIncomeReceiptsToUse.map((receipt) => mapReceiptToIncomeListEntry(receipt)),
  ];

  return {
    entries,
    incomes,
    truncated: newEntryResult.truncated || receiptResult.truncated,
  };
}

/** 支出だけを扱う既存caller向けの互換ラッパー。 */
export async function loadSpendingEntriesForSearch(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate?: string,
  endDate?: string,
): Promise<{ entries: SpendingEntry[]; truncated: boolean }> {
  const result = await loadHistoryEntriesForSearch(ctx, groupId, startDate, endDate);
  return { entries: result.entries, truncated: result.truncated };
}

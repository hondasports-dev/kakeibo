import type { QueryCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { addDays, getMonthEndDate } from "../../domain/common/date";
import {
  addLegacyReceiptGroups,
  enrichSpendingEntries,
  mapExpenseEntryToSpendingEntry as mapExpenseEntryToSpendingEntryDomain,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
  type SpendingEntry,
  type IncomeListEntry,
  type EnrichSpendingEntryAiExpenseDraft,
  type EnrichSpendingEntryAiExpenseDraftItem,
  type EnrichSpendingEntrySourceDocument,
} from "../../domain/receipt/spendingEntry";
import { ConvexError } from "convex/values";

export {
  addLegacyReceiptGroups,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
  type IncomeListEntry,
  type SpendingEntry,
} from "../../domain/receipt/spendingEntry";
// mapExpenseEntryToSpendingEntry は本ファイルで adapter ラッパーとして定義するため domain からは re-export しない

export function mapExpenseEntryToSpendingEntry(
  expenseEntry: Pick<
    Doc<"expenseEntries">,
    | "_id"
    | "date"
    | "amount"
    | "categoryId"
    | "title"
    | "memo"
    | "entryType"
    | "sourceDocumentId"
    | "aiExpenseDraftId"
  >,
): SpendingEntry {
  const result = mapExpenseEntryToSpendingEntryDomain(expenseEntry);
  if (!result.success) {
    throw new ConvexError("Expense entry category is required for spending aggregation");
  }
  return result.entry;
}

type ReceiptLinkage = {
  entry: SpendingEntry;
  sourceDocumentId?: Id<"sourceDocuments">;
  aiExpenseDraftId?: Id<"aiExpenseDrafts">;
};

async function fetchReceiptEnrichmentData(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  linkages: ReceiptLinkage[],
): Promise<{
  sourceDocumentMap: Map<string, EnrichSpendingEntrySourceDocument>;
  aiExpenseDraftMap: Map<string, EnrichSpendingEntryAiExpenseDraft>;
  aiExpenseDraftItemsMap: Map<string, EnrichSpendingEntryAiExpenseDraftItem[]>;
}> {
  const uniqueSourceDocumentIds = Array.from(
    new Set(
      linkages
        .map(({ sourceDocumentId }) => sourceDocumentId)
        .filter((id): id is Id<"sourceDocuments"> => id !== undefined),
    ),
  );
  const uniqueAiExpenseDraftIds = Array.from(
    new Set(
      linkages
        .map(({ aiExpenseDraftId }) => aiExpenseDraftId)
        .filter((id): id is Id<"aiExpenseDrafts"> => id !== undefined),
    ),
  );
  const [sourceDocuments, aiExpenseDrafts] = await Promise.all([
    Promise.all(uniqueSourceDocumentIds.map((id) => ctx.db.get(id))),
    Promise.all(uniqueAiExpenseDraftIds.map((id) => ctx.db.get(id))),
  ]);
  const aiExpenseDraftItems = await Promise.all(
    uniqueAiExpenseDraftIds.map(async (draftId) => {
      const items = await ctx.db
        .query("aiExpenseDraftItems")
        .withIndex("by_group_id_and_draft_id", (q) =>
          q.eq("groupId", groupId).eq("draftId", draftId),
        )
        .order("asc")
        .take(100);
      return [draftId, items] as const;
    }),
  );

  const sourceDocumentMap = new Map<string, EnrichSpendingEntrySourceDocument>();
  for (const document of sourceDocuments) {
    if (document !== null && document.groupId === groupId) {
      sourceDocumentMap.set(document._id as string, {
        _id: document._id as string,
        shopName: document.shopName,
        totalAmount: document.totalAmount,
      });
    }
  }

  const aiExpenseDraftMap = new Map<string, EnrichSpendingEntryAiExpenseDraft>();
  for (const draft of aiExpenseDrafts) {
    if (draft !== null && draft.groupId === groupId) {
      aiExpenseDraftMap.set(draft._id as string, {
        _id: draft._id as string,
        shopName: draft.shopName,
        payeeName: draft.payeeName,
        amountYen: draft.amountYen,
      });
    }
  }

  const aiExpenseDraftItemsMap = new Map<string, EnrichSpendingEntryAiExpenseDraftItem[]>();
  for (const [draftId, items] of aiExpenseDraftItems) {
    aiExpenseDraftItemsMap.set(
      draftId as string,
      items
        .filter((item) => item.categoryId !== undefined && item.itemName !== undefined)
        .map((item) => ({
          categoryId: item.categoryId as string,
          itemName: item.itemName as string,
        })),
    );
  }

  return { sourceDocumentMap, aiExpenseDraftMap, aiExpenseDraftItemsMap };
}

async function enrichSpendingEntriesWithReceiptGroups(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  linkages: ReceiptLinkage[],
): Promise<SpendingEntry[]> {
  const { sourceDocumentMap, aiExpenseDraftMap, aiExpenseDraftItemsMap } =
    await fetchReceiptEnrichmentData(ctx, groupId, linkages);

  return enrichSpendingEntries(
    linkages.map(({ entry, sourceDocumentId, aiExpenseDraftId }) => ({
      entry,
      sourceDocumentId: sourceDocumentId as string | undefined,
      aiExpenseDraftId: aiExpenseDraftId as string | undefined,
    })),
    sourceDocumentMap,
    aiExpenseDraftMap,
    aiExpenseDraftItemsMap,
  );
}

function mapExpenseEntriesToReceiptLinkages(entries: Doc<"expenseEntries">[]): ReceiptLinkage[] {
  return entries.map((entry) => ({
    entry: mapExpenseEntryToSpendingEntry(entry),
    sourceDocumentId: entry.sourceDocumentId,
    aiExpenseDraftId: entry.aiExpenseDraftId,
  }));
}

async function fetchExpenseEntriesByDateRange(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate: string,
  endDate: string,
): Promise<Doc<"expenseEntries">[]> {
  const entries: Doc<"expenseEntries">[] = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", startDate).lte("date", endDate),
    )) {
    entries.push(entry);
  }
  return entries;
}

async function fetchReceiptsByDateRange(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  startDate: string,
  endDate: string,
): Promise<Doc<"receipts">[]> {
  const receipts: Doc<"receipts">[] = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", startDate).lte("date", endDate),
    )) {
    receipts.push(receipt);
  }
  return receipts;
}

export async function getWeekIncomeEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  weekStartDate: string,
): Promise<IncomeListEntry[]> {
  const weekEndDate = addDays(weekStartDate, 6);
  const expenseEntries = await fetchExpenseEntriesByDateRange(
    ctx,
    groupId,
    weekStartDate,
    weekEndDate,
  );
  const incomeEntriesForWeek = expenseEntries.filter((entry) => entry.entryType === "income");
  if (incomeEntriesForWeek.length > 0) {
    return incomeEntriesForWeek.map((entry) => mapIncomeExpenseEntryToListEntry(entry));
  }

  if (expenseEntries.length > 0) {
    return [];
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, weekStartDate, weekEndDate);
  return receipts
    .filter((receipt) => receipt.type === "income")
    .map((receipt) => mapReceiptToIncomeListEntry(receipt));
}

export async function getWeekSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  weekStartDate: string,
): Promise<SpendingEntry[]> {
  const weekEndDate = addDays(weekStartDate, 6);
  const expenseEntries = await fetchExpenseEntriesByDateRange(
    ctx,
    groupId,
    weekStartDate,
    weekEndDate,
  );
  const expenseEntriesForWeek = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForWeek.length > 0) {
    return enrichSpendingEntriesWithReceiptGroups(
      ctx,
      groupId,
      mapExpenseEntriesToReceiptLinkages(expenseEntriesForWeek),
    );
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, weekStartDate, weekEndDate);
  return addLegacyReceiptGroups(
    receipts
      .filter((receipt) => receipt.type !== "income")
      .map((receipt) => mapReceiptToSpendingEntry(receipt)),
  );
}

export async function getDateSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  date: string,
): Promise<SpendingEntry[]> {
  const expenseEntries = await fetchExpenseEntriesByDateRange(ctx, groupId, date, date);
  const expenseEntriesForDate = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForDate.length > 0) {
    return enrichSpendingEntriesWithReceiptGroups(
      ctx,
      groupId,
      mapExpenseEntriesToReceiptLinkages(expenseEntriesForDate),
    );
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, date, date);
  return addLegacyReceiptGroups(
    receipts
      .filter((receipt) => receipt.type !== "income")
      .map((receipt) => mapReceiptToSpendingEntry(receipt)),
  );
}

export async function getMonthSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  monthStartDate: string,
): Promise<SpendingEntry[]> {
  const monthEndDate = getMonthEndDate(monthStartDate);
  const expenseEntries = await fetchExpenseEntriesByDateRange(
    ctx,
    groupId,
    monthStartDate,
    monthEndDate,
  );
  const monthExpenseEntries = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (monthExpenseEntries.length > 0) {
    return enrichSpendingEntriesWithReceiptGroups(
      ctx,
      groupId,
      mapExpenseEntriesToReceiptLinkages(monthExpenseEntries),
    );
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, monthStartDate, monthEndDate);
  return addLegacyReceiptGroups(
    receipts
      .filter((receipt) => receipt.type !== "income")
      .map((receipt) => mapReceiptToSpendingEntry(receipt)),
  );
}

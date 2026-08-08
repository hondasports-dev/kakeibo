import type { QueryCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { addDays, getMonthEndDate } from "../../domain/common/date";
import {
  addLegacyReceiptGroups,
  mapExpenseEntryToSpendingEntry as mapExpenseEntryToSpendingEntryDomain,
  mapIncomeExpenseEntryToListEntry,
  mapReceiptToIncomeListEntry,
  mapReceiptToSpendingEntry,
  type SpendingEntry,
  type IncomeListEntry,
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

async function enrichSpendingEntriesWithReceiptGroups(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  linkages: ReceiptLinkage[],
): Promise<SpendingEntry[]> {
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

  const sourceDocumentMap = new Map(
    sourceDocuments
      .filter((document) => document !== null && document.groupId === groupId)
      .map((document) => [document!._id as string, document!]),
  );
  const aiExpenseDraftMap = new Map(
    aiExpenseDrafts
      .filter((draft) => draft !== null && draft.groupId === groupId)
      .map((draft) => [draft!._id as string, draft!]),
  );
  const aiExpenseDraftItemsMap = new Map(aiExpenseDraftItems);

  return linkages.map(({ entry, sourceDocumentId, aiExpenseDraftId }) => {
    const sourceDocument = sourceDocumentId ? sourceDocumentMap.get(sourceDocumentId) : undefined;
    const aiExpenseDraft = aiExpenseDraftId ? aiExpenseDraftMap.get(aiExpenseDraftId) : undefined;

    if (sourceDocument !== undefined) {
      return {
        ...entry,
        receiptGroupId: `sourceDocument:${sourceDocument._id}`,
        receiptShopName: sourceDocument.shopName ?? entry.shopName,
        receiptTotalAmountYen: sourceDocument.totalAmount ?? entry.amountYen,
        itemName: entry.shopName,
      };
    }

    if (aiExpenseDraft !== undefined) {
      const itemNames = aiExpenseDraftItemsMap
        .get(aiExpenseDraft._id)
        ?.filter((item) => item.categoryId === entry.categoryId)
        .map((item) => item.itemName.trim())
        .filter(Boolean);

      return {
        ...entry,
        receiptGroupId: `aiExpenseDraft:${aiExpenseDraft._id}`,
        receiptShopName:
          aiExpenseDraft.shopName ?? aiExpenseDraft.payeeName ?? entry.shopName ?? "不明",
        receiptTotalAmountYen: aiExpenseDraft.amountYen ?? entry.amountYen,
        itemName: itemNames && itemNames.length > 0 ? itemNames.join("、") : entry.shopName,
      };
    }

    return {
      ...entry,
      receiptGroupId: `expenseEntry:${entry._id}`,
      receiptShopName: entry.shopName,
      receiptTotalAmountYen: entry.amountYen,
    };
  });
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

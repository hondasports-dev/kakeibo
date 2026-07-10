import type { QueryCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { addDays, getMonthEndDate } from "../dateUtils";

export type SpendingEntry = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
  recordType: "expenseEntry" | "receipt";
};

export type IncomeListEntry = {
  _id: string;
  date: string;
  type: "income";
  bankName?: string;
  amountYen: number;
  memo?: string;
  recordType: "expenseEntry" | "receipt";
};

export function mapReceiptToSpendingEntry(
  receipt: Pick<
    Doc<"receipts">,
    "_id" | "date" | "type" | "shopName" | "bankName" | "amountYen" | "categoryId" | "memo"
  >,
): SpendingEntry {
  return {
    _id: receipt._id,
    date: receipt.date,
    type: receipt.type,
    shopName: receipt.shopName,
    bankName: receipt.bankName,
    amountYen: receipt.amountYen,
    categoryId: receipt.categoryId,
    memo: receipt.memo,
    recordType: "receipt",
  };
}

export function mapExpenseEntryToSpendingEntry(
  expenseEntry: Pick<
    Doc<"expenseEntries">,
    "_id" | "date" | "amount" | "categoryId" | "title" | "memo" | "entryType"
  >,
): SpendingEntry {
  if (!expenseEntry.categoryId) {
    throw new Error("Expense entry category is required for spending aggregation");
  }
  return {
    _id: expenseEntry._id,
    date: expenseEntry.date,
    type: expenseEntry.entryType,
    shopName: expenseEntry.entryType === "expense" ? expenseEntry.title : undefined,
    bankName: expenseEntry.entryType === "income" ? expenseEntry.title : undefined,
    amountYen: expenseEntry.amount,
    categoryId: expenseEntry.categoryId,
    memo: expenseEntry.memo,
    recordType: "expenseEntry",
  };
}

export function mapIncomeExpenseEntryToListEntry(
  expenseEntry: Pick<Doc<"expenseEntries">, "_id" | "date" | "amount" | "title" | "memo">,
): IncomeListEntry {
  return {
    _id: expenseEntry._id,
    date: expenseEntry.date,
    type: "income",
    bankName: expenseEntry.title,
    amountYen: expenseEntry.amount,
    memo: expenseEntry.memo,
    recordType: "expenseEntry",
  };
}

export function mapReceiptToIncomeListEntry(
  receipt: Pick<Doc<"receipts">, "_id" | "date" | "bankName" | "amountYen" | "memo">,
): IncomeListEntry {
  return {
    _id: receipt._id,
    date: receipt.date,
    type: "income",
    bankName: receipt.bankName,
    amountYen: receipt.amountYen,
    memo: receipt.memo,
    recordType: "receipt",
  };
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

async function fetchReceiptsByWeek(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  weekStartDate: string,
): Promise<Doc<"receipts">[]> {
  const receipts: Doc<"receipts">[] = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", weekStartDate),
    )
    .order("desc")) {
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

  const receipts = await fetchReceiptsByWeek(ctx, groupId, weekStartDate);
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
    return expenseEntriesForWeek.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts = await fetchReceiptsByWeek(ctx, groupId, weekStartDate);
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

export async function getDateSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  date: string,
): Promise<SpendingEntry[]> {
  const expenseEntries = await fetchExpenseEntriesByDateRange(ctx, groupId, date, date);
  const expenseEntriesForDate = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForDate.length > 0) {
    return expenseEntriesForDate.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, date, date);
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
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
    return monthExpenseEntries.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts = await fetchReceiptsByDateRange(ctx, groupId, monthStartDate, monthEndDate);
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

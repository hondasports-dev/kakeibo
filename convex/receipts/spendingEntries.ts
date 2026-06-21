import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type SpendingEntry = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
};

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMonthEndDate(monthStartDate: string): string {
  const [yearStr, monthStr] = monthStartDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
}

export function mapReceiptToSpendingEntry(receipt: {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
}): SpendingEntry {
  return {
    _id: receipt._id,
    date: receipt.date,
    type: receipt.type,
    shopName: receipt.shopName,
    bankName: receipt.bankName,
    amountYen: receipt.amountYen,
    categoryId: receipt.categoryId,
    memo: receipt.memo,
  };
}

export function mapExpenseEntryToSpendingEntry(expenseEntry: {
  _id: string;
  date: string;
  amount: number;
  categoryId: string;
  title: string;
  memo?: string;
  entryType: "expense" | "income";
}): SpendingEntry {
  return {
    _id: expenseEntry._id,
    date: expenseEntry.date,
    type: expenseEntry.entryType,
    shopName: expenseEntry.entryType === "expense" ? expenseEntry.title : undefined,
    bankName: expenseEntry.entryType === "income" ? expenseEntry.title : undefined,
    amountYen: expenseEntry.amount,
    categoryId: expenseEntry.categoryId,
    memo: expenseEntry.memo,
  };
}

export async function getWeekSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  weekStartDate: string,
) {
  const weekEndDate = addDays(weekStartDate, 6);
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", weekStartDate).lte("date", weekEndDate),
    )) {
    expenseEntries.push(entry);
  }
  const expenseEntriesForWeek = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForWeek.length > 0) {
    return expenseEntriesForWeek.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", weekStartDate),
    )
    .order("desc")) {
    receipts.push(receipt);
  }

  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

export async function getDateSpendingEntries(ctx: QueryCtx, groupId: Id<"groups">, date: string) {
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", date))) {
    expenseEntries.push(entry);
  }
  const expenseEntriesForDate = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForDate.length > 0) {
    return expenseEntriesForDate.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", date))) {
    receipts.push(receipt);
  }
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

export async function getMonthSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  monthStartDate: string,
) {
  const monthEndDate = getMonthEndDate(monthStartDate);
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", monthStartDate).lte("date", monthEndDate),
    )) {
    expenseEntries.push(entry);
  }
  const monthExpenseEntries = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (monthExpenseEntries.length > 0) {
    return monthExpenseEntries.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", monthStartDate).lte("date", monthEndDate),
    )) {
    receipts.push(receipt);
  }
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

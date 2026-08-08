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
  itemName?: string;
  receiptGroupId?: string;
  receiptShopName?: string;
  receiptTotalAmountYen?: number;
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

export type ReceiptForSpending = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
};

export function mapReceiptToSpendingEntry(receipt: ReceiptForSpending): SpendingEntry {
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

export type ExpenseEntryForSpending = {
  _id: string;
  date: string;
  amount: number;
  categoryId?: string | null | undefined;
  title?: string;
  memo?: string;
  entryType: "expense" | "income";
  sourceDocumentId?: string;
  aiExpenseDraftId?: string;
};

export type ExpenseEntryToSpendingError = "missing_category";

export function mapExpenseEntryToSpendingEntry(
  expenseEntry: ExpenseEntryForSpending,
):
  | { success: true; entry: SpendingEntry }
  | { success: false; error: ExpenseEntryToSpendingError } {
  if (!expenseEntry.categoryId) {
    return { success: false, error: "missing_category" };
  }
  return {
    success: true,
    entry: {
      _id: expenseEntry._id,
      date: expenseEntry.date,
      type: expenseEntry.entryType,
      shopName: expenseEntry.entryType === "expense" ? expenseEntry.title : undefined,
      bankName: expenseEntry.entryType === "income" ? expenseEntry.title : undefined,
      amountYen: expenseEntry.amount,
      categoryId: expenseEntry.categoryId,
      memo: expenseEntry.memo,
      recordType: "expenseEntry",
    },
  };
}

export type ExpenseEntryForIncomeList = {
  _id: string;
  date: string;
  amount: number;
  title?: string;
  memo?: string;
};

export function mapIncomeExpenseEntryToListEntry(
  expenseEntry: ExpenseEntryForIncomeList,
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

export type ReceiptForIncomeList = {
  _id: string;
  date: string;
  bankName?: string;
  amountYen: number;
  memo?: string;
};

export function mapReceiptToIncomeListEntry(receipt: ReceiptForIncomeList): IncomeListEntry {
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

export function addLegacyReceiptGroups(entries: SpendingEntry[]): SpendingEntry[] {
  return entries.map((entry) => ({
    ...entry,
    receiptGroupId: `receipt:${entry._id}`,
    receiptShopName: entry.shopName,
    receiptTotalAmountYen: entry.amountYen,
  }));
}

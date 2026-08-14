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

export type EnrichSpendingEntrySourceDocument = {
  _id: string;
  shopName?: string;
  totalAmount?: number;
};

export type EnrichSpendingEntryAiExpenseDraft = {
  _id: string;
  shopName?: string;
  payeeName?: string;
  amountYen?: number;
};

export type EnrichSpendingEntryAiExpenseDraftItem = {
  categoryId: string;
  itemName: string;
};

export type EnrichSpendingEntryArgs = {
  sourceDocument?: EnrichSpendingEntrySourceDocument;
  aiExpenseDraft?: EnrichSpendingEntryAiExpenseDraft;
  aiExpenseDraftItems?: EnrichSpendingEntryAiExpenseDraftItem[];
};

export function enrichSpendingEntry(
  entry: SpendingEntry,
  { sourceDocument, aiExpenseDraft, aiExpenseDraftItems }: EnrichSpendingEntryArgs,
): SpendingEntry {
  if (sourceDocument) {
    return {
      ...entry,
      receiptGroupId: `sourceDocument:${sourceDocument._id}`,
      receiptShopName: sourceDocument.shopName ?? entry.shopName,
      receiptTotalAmountYen: sourceDocument.totalAmount ?? entry.amountYen,
      itemName: entry.shopName,
    };
  }

  if (aiExpenseDraft) {
    const itemNames = (aiExpenseDraftItems ?? [])
      .filter((item) => item.categoryId === entry.categoryId)
      .map((item) => item.itemName.trim())
      .filter(Boolean);

    return {
      ...entry,
      receiptGroupId: `aiExpenseDraft:${aiExpenseDraft._id}`,
      receiptShopName:
        aiExpenseDraft.shopName ?? aiExpenseDraft.payeeName ?? entry.shopName ?? "不明",
      receiptTotalAmountYen: aiExpenseDraft.amountYen ?? entry.amountYen,
      itemName: itemNames.length > 0 ? itemNames.join("、") : entry.shopName,
    };
  }

  return {
    ...entry,
    receiptGroupId: `expenseEntry:${entry._id}`,
    receiptShopName: entry.shopName,
    receiptTotalAmountYen: entry.amountYen,
  };
}

export function enrichSpendingEntries(
  linkages: Array<{
    entry: SpendingEntry;
    sourceDocumentId?: string;
    aiExpenseDraftId?: string;
  }>,
  sourceDocumentMap: Map<string, EnrichSpendingEntrySourceDocument>,
  aiExpenseDraftMap: Map<string, EnrichSpendingEntryAiExpenseDraft>,
  aiExpenseDraftItemsMap: Map<string, EnrichSpendingEntryAiExpenseDraftItem[]>,
): SpendingEntry[] {
  return linkages.map(({ entry, sourceDocumentId, aiExpenseDraftId }) =>
    enrichSpendingEntry(entry, {
      sourceDocument: sourceDocumentId ? sourceDocumentMap.get(sourceDocumentId) : undefined,
      aiExpenseDraft: aiExpenseDraftId ? aiExpenseDraftMap.get(aiExpenseDraftId) : undefined,
      aiExpenseDraftItems: aiExpenseDraftId
        ? aiExpenseDraftItemsMap.get(aiExpenseDraftId)
        : undefined,
    }),
  );
}

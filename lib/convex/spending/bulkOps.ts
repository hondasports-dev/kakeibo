export const MAX_BULK_SPENDING_SELECTION = 100;

export type BulkSpendingIdSets = {
  expenseEntryIds: string[];
  receiptIds: string[];
};

export function dedupeIds<T extends string>(ids: T[]): T[] {
  return Array.from(new Set(ids));
}

export function countBulkSpendingIds(args: BulkSpendingIdSets): number {
  return dedupeIds(args.expenseEntryIds).length + dedupeIds(args.receiptIds).length;
}

export function isExpenseReceiptType(type: "expense" | "income" | undefined): boolean {
  return type === undefined || type === "expense";
}

export function getBulkSpendingLimitErrorMessage(): string {
  return `一度に選べる明細は${MAX_BULK_SPENDING_SELECTION}件までです`;
}

export function canSelectAnotherSpendingRecord(selectedCount: number): boolean {
  return selectedCount < MAX_BULK_SPENDING_SELECTION;
}

import type { SpendingEntry } from "../receipt/spendingEntry";
import { isValidIsoDateString } from "../week/weekDates";

export type SearchableReceiptGroup = {
  id: string;
  date: string;
  shopName: string;
  amountYen: number;
  items: SpendingEntry[];
};

export type ExpenseSearchFilters = {
  shopQuery?: string;
  categoryId?: string;
  minAmountYen?: number;
  maxAmountYen?: number;
  startDate?: string;
  endDate?: string;
};

export type ExpenseSearchFilterInput = {
  shopQuery?: string;
  categoryId?: string;
  minAmountYen?: number;
  maxAmountYen?: number;
  startDate?: string;
  endDate?: string;
};

export type ParsedExpenseSearchFilters =
  | { ok: true; filters: ExpenseSearchFilters }
  | { ok: false; error: string };

const SHOP_QUERY_MAX_LENGTH = 80;

function normalizeShopText(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ja");
}

export function groupSpendingEntries(entries: SpendingEntry[]): SearchableReceiptGroup[] {
  const groups = new Map<string, SearchableReceiptGroup>();

  for (const item of entries) {
    const id = item.receiptGroupId ?? `${item.recordType}:${item._id}`;
    const existing = groups.get(id);
    if (existing) {
      existing.items.push(item);
      if (item.receiptTotalAmountYen !== undefined) {
        existing.amountYen = item.receiptTotalAmountYen;
      }
      continue;
    }

    groups.set(id, {
      id,
      date: item.date,
      shopName: item.receiptShopName ?? item.shopName ?? "不明",
      amountYen: item.receiptTotalAmountYen ?? item.amountYen,
      items: [item],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    amountYen: group.amountYen ?? group.items.reduce((sum, item) => sum + item.amountYen, 0),
  }));
}

function matchesShopQuery(group: SearchableReceiptGroup, shopQuery: string): boolean {
  const query = normalizeShopText(shopQuery);
  if (query.length === 0) {
    return true;
  }

  const haystacks = [
    group.shopName,
    ...group.items.flatMap((item) => [item.shopName, item.itemName, item.receiptShopName]),
  ];

  return haystacks.some((value) => normalizeShopText(value).includes(query));
}

export function filterReceiptGroups(
  groups: SearchableReceiptGroup[],
  filters: ExpenseSearchFilters,
): SearchableReceiptGroup[] {
  return groups.filter((group) => {
    if (filters.shopQuery !== undefined && !matchesShopQuery(group, filters.shopQuery)) {
      return false;
    }

    if (
      filters.categoryId !== undefined &&
      !group.items.some((item) => item.categoryId === filters.categoryId)
    ) {
      return false;
    }

    if (filters.minAmountYen !== undefined && group.amountYen < filters.minAmountYen) {
      return false;
    }

    if (filters.maxAmountYen !== undefined && group.amountYen > filters.maxAmountYen) {
      return false;
    }

    if (filters.startDate !== undefined && group.date < filters.startDate) {
      return false;
    }

    if (filters.endDate !== undefined && group.date > filters.endDate) {
      return false;
    }

    return true;
  });
}

function compareReceiptGroups(left: SearchableReceiptGroup, right: SearchableReceiptGroup): number {
  const dateOrder = right.date.localeCompare(left.date);
  if (dateOrder !== 0) {
    return dateOrder;
  }
  return right.id.localeCompare(left.id);
}

export function paginateReceiptGroups(
  groups: SearchableReceiptGroup[],
  paginationOpts: { numItems: number; cursor: string | null },
): {
  page: SearchableReceiptGroup[];
  continueCursor: string;
  isDone: boolean;
} {
  const ordered = [...groups].sort(compareReceiptGroups);
  const startIndex = paginationOpts.cursor ? Number.parseInt(paginationOpts.cursor, 10) : 0;
  const safeStart = Number.isFinite(startIndex) && startIndex > 0 ? startIndex : 0;
  const page = ordered.slice(safeStart, safeStart + paginationOpts.numItems);
  const nextIndex = safeStart + page.length;
  const isDone = nextIndex >= ordered.length;

  return {
    page,
    continueCursor: String(nextIndex),
    isDone,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function parseExpenseSearchFilters(
  input: ExpenseSearchFilterInput,
): ParsedExpenseSearchFilters {
  const filters: ExpenseSearchFilters = {};
  const shopQuery = input.shopQuery?.trim();
  if (shopQuery) {
    if (shopQuery.length > SHOP_QUERY_MAX_LENGTH) {
      return { ok: false, error: `店名は${SHOP_QUERY_MAX_LENGTH}文字以内で指定してください` };
    }
    filters.shopQuery = shopQuery;
  }

  if (input.categoryId !== undefined && input.categoryId.length > 0) {
    filters.categoryId = input.categoryId;
  }

  if (input.minAmountYen !== undefined) {
    if (!isNonNegativeInteger(input.minAmountYen)) {
      return { ok: false, error: "金額は0以上の整数で指定してください" };
    }
    filters.minAmountYen = input.minAmountYen;
  }

  if (input.maxAmountYen !== undefined) {
    if (!isNonNegativeInteger(input.maxAmountYen)) {
      return { ok: false, error: "金額は0以上の整数で指定してください" };
    }
    filters.maxAmountYen = input.maxAmountYen;
  }

  if (
    filters.minAmountYen !== undefined &&
    filters.maxAmountYen !== undefined &&
    filters.minAmountYen > filters.maxAmountYen
  ) {
    return { ok: false, error: "金額の下限は上限以下にしてください" };
  }

  if (input.startDate !== undefined && input.startDate.length > 0) {
    if (!isValidIsoDateString(input.startDate)) {
      return { ok: false, error: "日付はYYYY-MM-DD形式で指定してください" };
    }
    filters.startDate = input.startDate;
  }

  if (input.endDate !== undefined && input.endDate.length > 0) {
    if (!isValidIsoDateString(input.endDate)) {
      return { ok: false, error: "日付はYYYY-MM-DD形式で指定してください" };
    }
    filters.endDate = input.endDate;
  }

  if (
    filters.startDate !== undefined &&
    filters.endDate !== undefined &&
    filters.startDate > filters.endDate
  ) {
    return { ok: false, error: "開始日は終了日以前にしてください" };
  }

  return { ok: true, filters };
}

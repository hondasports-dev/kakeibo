import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { buildCategoryInfoMap } from "../receipts/summaryLib/categoryAggregation";
import {
  buildHistoryComparison,
  buildHistoryTrend,
  calculatePreviousHistoryPeriod,
  summarizeHistoryGroups,
  type HistoryAggregate,
  type HistoryComparison,
  type HistoryTrendPoint,
} from "../../domain/expenseSearch/analytics";
import {
  filterHistoryGroups,
  groupHistoryEntries,
  paginateHistoryGroups,
  parseExpenseSearchFilters,
  type SearchableHistoryGroup,
} from "../../domain/expenseSearch/filter";
import { loadHistoryEntriesForSearch } from "./loadSpendingEntries";

export type ExpenseSearchArgs = {
  entryType?: "all" | "expense" | "income";
  shopQuery?: string;
  categoryId?: Id<"categories">;
  minAmountYen?: number;
  maxAmountYen?: number;
  startDate?: string;
  endDate?: string;
  paginationOpts: PaginationOptions;
};

export type ExpenseSearchReceipt = {
  _id: string;
  date: string;
  type: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  memo?: string;
  recordType: "expenseEntry" | "receipt";
  itemName?: string;
  receiptGroupId?: string;
  receiptShopName?: string;
  receiptTotalAmountYen?: number;
};

export type ExpenseSearchResult = {
  page: ExpenseSearchReceipt[];
  continueCursor: string;
  isDone: boolean;
  truncated: boolean;
  comparisonTruncated: boolean;
  matchedGroupCount: number;
  totalCount: number;
  expenseCount: number;
  incomeCount: number;
  totalExpenseYen: number;
  totalIncomeYen: number;
  netAmountYen: number;
  byCategory: HistoryAggregate["byCategory"];
  trend: HistoryTrendPoint[];
  comparison: HistoryComparison | null;
};

function emptySearchResult(): ExpenseSearchResult {
  return {
    page: [],
    continueCursor: "v1.empty",
    isDone: true,
    truncated: false,
    comparisonTruncated: false,
    matchedGroupCount: 0,
    totalCount: 0,
    expenseCount: 0,
    incomeCount: 0,
    totalExpenseYen: 0,
    totalIncomeYen: 0,
    netAmountYen: 0,
    byCategory: [],
    trend: [],
    comparison: null,
  };
}

function collectCategoryIds(groups: SearchableHistoryGroup[]): string[] {
  return Array.from(
    new Set(
      groups.flatMap((group) =>
        group.type === "income" ? [] : group.items.map((item) => item.categoryId),
      ),
    ),
  );
}

function mapHistoryGroupToItems(
  group: SearchableHistoryGroup,
  categoryInfoMap: Map<string, { name: string; color: string }>,
): ExpenseSearchReceipt[] {
  if (group.type === "income") {
    const income = group.income;
    return [
      {
        _id: income._id,
        date: income.date,
        type: "income",
        bankName: income.bankName,
        amountYen: income.amountYen,
        memo: income.memo,
        recordType: income.recordType,
      },
    ];
  }

  return group.items.map((item) => {
    const info = categoryInfoMap.get(item.categoryId);
    return {
      _id: item._id,
      date: item.date,
      type: "expense",
      shopName: item.shopName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
      categoryName: info?.name ?? "不明",
      categoryColor: info?.color ?? "#AAB7C4",
      memo: item.memo,
      recordType: item.recordType,
      itemName: item.itemName,
      receiptGroupId: item.receiptGroupId,
      receiptShopName: item.receiptShopName,
      receiptTotalAmountYen: item.receiptTotalAmountYen,
    };
  });
}

export async function searchExpensesHandler(
  ctx: QueryCtx,
  args: ExpenseSearchArgs,
): Promise<ExpenseSearchResult> {
  const { groupId } = await requireGroupMembership(ctx);
  const parsed = parseExpenseSearchFilters({
    entryType: args.entryType,
    shopQuery: args.shopQuery,
    categoryId: args.categoryId,
    minAmountYen: args.minAmountYen,
    maxAmountYen: args.maxAmountYen,
    startDate: args.startDate,
    endDate: args.endDate,
  });
  if (!parsed.ok) {
    throw new ConvexError(parsed.error);
  }

  if (parsed.filters.categoryId !== undefined) {
    const category = await ctx.db.get(parsed.filters.categoryId as Id<"categories">);
    if (category?.groupId !== groupId) {
      return emptySearchResult();
    }
  }

  const source = await loadHistoryEntriesForSearch(
    ctx,
    groupId,
    parsed.filters.startDate,
    parsed.filters.endDate,
  );
  const groups = filterHistoryGroups(
    groupHistoryEntries(source.entries, source.incomes),
    parsed.filters,
  );

  // 前期間比較は初回ページでだけ計算する。ページ追加時は現在期間の集計を
  // 更新しつつ、初回レスポンスの比較をUI側で保持することで、同じ比較を
  // 毎ページ読み直すコストと上限超過リスクを避ける。
  const previousPeriod =
    args.paginationOpts.cursor === null
      ? calculatePreviousHistoryPeriod(parsed.filters.startDate, parsed.filters.endDate)
      : null;
  let previousGroups: SearchableHistoryGroup[] = [];
  let previousTruncated = false;
  if (previousPeriod !== null) {
    const previousSource = await loadHistoryEntriesForSearch(
      ctx,
      groupId,
      previousPeriod.startDate,
      previousPeriod.endDate,
    );
    previousTruncated = previousSource.truncated;
    previousGroups = filterHistoryGroups(
      groupHistoryEntries(previousSource.entries, previousSource.incomes),
      {
        ...parsed.filters,
        startDate: previousPeriod.startDate,
        endDate: previousPeriod.endDate,
      },
    );
  }

  const categoryIds = Array.from(
    new Set([...collectCategoryIds(groups), ...collectCategoryIds(previousGroups)]),
  );
  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, categoryIds);
  const aggregate = summarizeHistoryGroups(groups, categoryInfoMap);
  const paged = paginateHistoryGroups(groups, args.paginationOpts);
  const page = paged.page.flatMap((group) => mapHistoryGroupToItems(group, categoryInfoMap));
  const comparison =
    previousPeriod === null
      ? null
      : buildHistoryComparison({
          current: aggregate,
          currentStartDate: parsed.filters.startDate!,
          currentEndDate: parsed.filters.endDate!,
          previous: summarizeHistoryGroups(previousGroups, categoryInfoMap),
          previousPeriod,
        });

  return {
    page,
    continueCursor: paged.continueCursor,
    isDone: paged.isDone,
    truncated: source.truncated,
    comparisonTruncated: previousTruncated,
    matchedGroupCount: groups.length,
    totalCount: aggregate.count,
    expenseCount: aggregate.expenseCount,
    incomeCount: aggregate.incomeCount,
    totalExpenseYen: aggregate.totalExpenseYen,
    totalIncomeYen: aggregate.totalIncomeYen,
    netAmountYen: aggregate.netAmountYen,
    byCategory: aggregate.byCategory,
    trend: buildHistoryTrend(groups, parsed.filters),
    comparison,
  };
}

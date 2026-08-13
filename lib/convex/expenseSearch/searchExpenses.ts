import { ConvexError } from "convex/values";
import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { buildCategoryInfoMap } from "../receipts/summaryLib/categoryAggregation";
import {
  filterReceiptGroups,
  groupSpendingEntries,
  paginateReceiptGroups,
  parseExpenseSearchFilters,
} from "../../domain/expenseSearch/filter";
import { loadSpendingEntriesForSearch } from "./loadSpendingEntries";

export type ExpenseSearchArgs = {
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
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
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
  matchedGroupCount: number;
};

export async function searchExpensesHandler(
  ctx: QueryCtx,
  args: ExpenseSearchArgs,
): Promise<ExpenseSearchResult> {
  const { groupId } = await requireGroupMembership(ctx);
  const parsed = parseExpenseSearchFilters({
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
      return {
        page: [],
        continueCursor: "0",
        isDone: true,
        truncated: false,
        matchedGroupCount: 0,
      };
    }
  }

  const { entries, truncated } = await loadSpendingEntriesForSearch(
    ctx,
    groupId,
    parsed.filters.startDate,
    parsed.filters.endDate,
  );
  const groups = filterReceiptGroups(groupSpendingEntries(entries), parsed.filters);
  const paged = paginateReceiptGroups(groups, args.paginationOpts);
  const pageItems = paged.page.flatMap((group) => group.items);
  const categoryIds = Array.from(new Set(pageItems.map((item) => item.categoryId)));
  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, categoryIds);

  return {
    page: pageItems.map((item) => {
      const info = categoryInfoMap.get(item.categoryId);
      return {
        _id: item._id,
        date: item.date,
        type: item.type,
        shopName: item.shopName,
        bankName: item.bankName,
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
    }),
    continueCursor: paged.continueCursor,
    isDone: paged.isDone,
    truncated,
    matchedGroupCount: groups.length,
  };
}

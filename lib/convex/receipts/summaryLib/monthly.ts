import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import {
  getMonthIncomeEntries,
  getMonthSpendingEntries,
} from "../../../../convex/receipts/spendingEntries";
import { ConvexError } from "convex/values";
import { getMonthStartDate, normalizeMonth } from "../../../domain/common/month";
import {
  buildCategoryInfoMap,
  summarizeByCategory,
  summarizeReceipts,
  type CategorySummary,
} from "./categoryAggregation";
import {
  summarizeMonthlyExpenses,
  type MonthlyExpensesSummary,
} from "../../../domain/receipt/monthlySummary";

export { type MonthlyExpensesSummary } from "../../../domain/receipt/monthlySummary";

type GetMonthlyExpensesSummaryArgs = {
  monthStartDate: string;
};

/** getMonthlyExpensesSummary query の handler ロジック（テスト用に export） */
export async function getMonthlyExpensesSummaryHandler(
  ctx: QueryCtx,
  args: GetMonthlyExpensesSummaryArgs,
): Promise<MonthlyExpensesSummary> {
  // groupId はレシートクエリに、userId は users テーブルの monthlyIncome 取得に使う
  const { groupId, userId } = await requireGroupMembership(ctx);

  const monthlyReceipts = await getMonthSpendingEntries(ctx, groupId, args.monthStartDate);

  // users テーブルから monthlyIncome を取得する
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  return summarizeMonthlyExpenses(monthlyReceipts, user?.monthlyIncome);
}

type GetMonthSummaryWithCategoriesArgs = {
  month: string;
};

export type MonthlySummaryWithCategories = {
  count: number;
  totalAmountYen: number;
  totalIncomeYen: number;
  netAmountYen: number;
  incomeCount: number;
  byCategory: CategorySummary[];
  receipts: Array<{
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
  }>;
  incomes: Array<{
    _id: string;
    date: string;
    type: "income";
    bankName?: string;
    amountYen: number;
    memo?: string;
    recordType: "expenseEntry" | "receipt";
  }>;
};

/** getMonthSummaryWithCategories query の handler ロジック（テスト用に export） */
export async function getMonthSummaryWithCategoriesHandler(
  ctx: QueryCtx,
  args: GetMonthSummaryWithCategoriesArgs,
): Promise<MonthlySummaryWithCategories> {
  const month = normalizeMonth(args.month);
  if (month === null) {
    throw new ConvexError("Invalid month");
  }

  const { groupId } = await requireGroupMembership(ctx);
  const monthStartDate = getMonthStartDate(month);
  const receipts = await getMonthSpendingEntries(ctx, groupId, monthStartDate);
  const incomes = await getMonthIncomeEntries(ctx, groupId, monthStartDate);

  const categoryIds = Array.from(new Set(receipts.map((receipt) => receipt.categoryId)));
  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, categoryIds);
  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const totalIncomeYen = incomes.reduce((sum, income) => sum + income.amountYen, 0);

  const receiptsWithCategory: MonthlySummaryWithCategories["receipts"] = receipts.map((receipt) => {
    const categoryId = receipt.categoryId;
    const info = categoryInfoMap.get(categoryId);
    return {
      _id: receipt._id,
      date: receipt.date,
      type: receipt.type,
      shopName: receipt.shopName,
      bankName: receipt.bankName,
      amountYen: receipt.amountYen,
      categoryId,
      categoryName: info?.name ?? "不明",
      categoryColor: info?.color ?? "#AAB7C4",
      memo: receipt.memo,
      recordType: receipt.recordType,
      itemName: receipt.itemName,
      receiptGroupId: receipt.receiptGroupId,
      receiptShopName: receipt.receiptShopName,
      receiptTotalAmountYen: receipt.receiptTotalAmountYen,
    };
  });

  return {
    count,
    totalAmountYen,
    totalIncomeYen,
    netAmountYen: totalIncomeYen - totalAmountYen,
    incomeCount: incomes.length,
    byCategory: summarizeByCategory(receipts, categoryInfoMap),
    receipts: receiptsWithCategory,
    incomes,
  };
}

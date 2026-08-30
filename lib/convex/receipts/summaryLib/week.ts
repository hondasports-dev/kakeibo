import type { QueryCtx } from "../../../../convex/_generated/server";
import { requireGroupMembership } from "../../../../convex/groups/membership";
import { calculateRelativeWeekStartDate } from "../../../../convex/lib/weekDates";
import {
  getWeekIncomeEntries,
  getWeekSpendingEntries,
} from "../../../../convex/receipts/spendingEntries";
import {
  buildCategoryInfoMap,
  summarizeByCategory,
  summarizeReceipts,
  type CategorySummary,
} from "./categoryAggregation";

type GetWeekSummaryArgs = {
  weekStartDate: string;
};

/** getWeekSummary query の handler ロジック（テスト用に export） */
export async function getWeekSummaryHandler(ctx: QueryCtx, args: GetWeekSummaryArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  const receipts = await getWeekSpendingEntries(ctx, groupId, args.weekStartDate);
  const prevWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -1);
  const prevWeekReceipts = await getWeekSpendingEntries(ctx, groupId, prevWeekStartDate);

  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const prevWeekSummary = summarizeReceipts(prevWeekReceipts);

  return {
    count,
    totalAmountYen,
    prevWeekReceiptCount: prevWeekSummary.count,
    prevWeekTotalAmountYen: prevWeekSummary.count > 0 ? prevWeekSummary.totalAmountYen : null,
  };
}

type GetWeekSummaryWithCategoriesArgs = {
  weekStartDate: string;
};

export type WeekSummaryWithCategories = {
  count: number;
  totalAmountYen: number;
  totalIncomeYen: number;
  incomeCount: number;
  byCategory: CategorySummary[];
  prevWeekReceiptCount: number;
  prevWeekTotalAmountYen: number | null;
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
    aiExpenseDraftId?: string;
    registrationMode?: "detailed" | "totalOnly";
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

/** getWeekSummaryWithCategories query の handler ロジック（テスト用に export） */
export async function getWeekSummaryWithCategoriesHandler(
  ctx: QueryCtx,
  args: GetWeekSummaryWithCategoriesArgs,
): Promise<WeekSummaryWithCategories> {
  const { groupId } = await requireGroupMembership(ctx);

  const receipts = await getWeekSpendingEntries(ctx, groupId, args.weekStartDate);
  const prevWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -1);
  const prevWeekReceipts = await getWeekSpendingEntries(ctx, groupId, prevWeekStartDate);

  const categoryIds = Array.from(new Set(receipts.map((receipt) => receipt.categoryId)));
  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, categoryIds);

  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const prevWeekSummary = summarizeReceipts(prevWeekReceipts);

  const receiptsWithCategory: WeekSummaryWithCategories["receipts"] = [];

  for (const receipt of receipts) {
    const categoryIdStr = receipt.categoryId as string;
    const info = categoryInfoMap.get(categoryIdStr);
    const name = info?.name ?? "不明";
    const color = info?.color ?? "#AAB7C4";

    receiptsWithCategory.push({
      _id: receipt._id,
      date: receipt.date,
      type: receipt.type,
      shopName: receipt.shopName,
      bankName: receipt.bankName,
      amountYen: receipt.amountYen,
      categoryId: categoryIdStr,
      categoryName: name,
      categoryColor: color,
      memo: receipt.memo,
      recordType: receipt.recordType,
      itemName: receipt.itemName,
      receiptGroupId: receipt.receiptGroupId,
      receiptShopName: receipt.receiptShopName,
      receiptTotalAmountYen: receipt.receiptTotalAmountYen,
      aiExpenseDraftId: receipt.aiExpenseDraftId,
      registrationMode: receipt.registrationMode,
    });
  }

  const byCategory = summarizeByCategory(receipts, categoryInfoMap);

  const incomeEntries = await getWeekIncomeEntries(ctx, groupId, args.weekStartDate);
  const totalIncomeYen = incomeEntries.reduce((sum, entry) => sum + entry.amountYen, 0);
  const incomeCount = incomeEntries.length;

  return {
    count,
    totalAmountYen,
    totalIncomeYen,
    incomeCount,
    byCategory,
    prevWeekReceiptCount: prevWeekSummary.count,
    prevWeekTotalAmountYen: prevWeekSummary.count > 0 ? prevWeekSummary.totalAmountYen : null,
    receipts: receiptsWithCategory,
    incomes: incomeEntries,
  };
}

export type FourWeeksSummaryData = {
  /** 直近4週分の集計データ。古い順（昇順）で返す */
  weeks: Array<{
    weekStartDate: string;
    totalAmountYen: number;
    byCategory: CategorySummary[];
  }>;
  /** データが存在する週の数（グラフ表示判定に使用） */
  weekCount: number;
};

type GetFourWeeksSummaryArgs = {
  weekStartDate: string;
};

/** getFourWeeksSummary query の handler ロジック（テスト用に export） */
export async function getFourWeeksSummaryHandler(
  ctx: QueryCtx,
  args: GetFourWeeksSummaryArgs,
): Promise<FourWeeksSummaryData> {
  const { groupId } = await requireGroupMembership(ctx);

  const weeklyReceipts: Array<{
    weekStartDate: string;
    receipts: Awaited<ReturnType<typeof getWeekSpendingEntries>>;
  }> = [];
  const allCategoryIds = new Set<string>();

  for (let i = 0; i < 4; i++) {
    const targetWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -i);
    const receipts = await getWeekSpendingEntries(ctx, groupId, targetWeekStartDate);
    weeklyReceipts.push({ weekStartDate: targetWeekStartDate, receipts });
    for (const receipt of receipts) {
      allCategoryIds.add(receipt.categoryId as string);
    }
  }

  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, Array.from(allCategoryIds));

  const descWeeks = weeklyReceipts.map(({ weekStartDate, receipts }) => {
    const { totalAmountYen } = summarizeReceipts(receipts);
    return {
      weekStartDate,
      totalAmountYen,
      byCategory: summarizeByCategory(receipts, categoryInfoMap),
    };
  });

  // 古い順（昇順）に並べ替え
  const weeks = descWeeks.reverse();

  const weekCount = weeks.filter((w) => w.totalAmountYen > 0).length;

  return { weeks, weekCount };
}

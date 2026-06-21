import { query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";
import { calculateRelativeWeekStartDate } from "../utils";
import {
  addDays,
  getDateSpendingEntries,
  getMonthSpendingEntries,
  getWeekSpendingEntries,
} from "./spendingEntries";

function summarizeReceipts(receipts: Array<{ amountYen: number }>) {
  const count = receipts.length;
  const totalAmountYen = receipts.reduce((sum, r) => sum + r.amountYen, 0);
  return { count, totalAmountYen };
}

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

type CategorySummary = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmountYen: number;
  count: number;
};

type GetWeekSummaryWithCategoriesArgs = {
  weekStartDate: string;
};

export type WeekSummaryWithCategories = {
  count: number;
  totalAmountYen: number;
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
  const categories = (await Promise.all(
    categoryIds.map((categoryId) => ctx.db.get(categoryId as Id<"categories">)),
  )) as Array<Doc<"categories"> | null>;

  // カテゴリ情報を id → {name, color} の Map に変換
  const categoryInfoMap = new Map<string, { name: string; color: string }>();
  for (const category of categories) {
    if (category === null || category.groupId !== groupId) {
      continue;
    }
    categoryInfoMap.set(category._id as string, {
      name: category.name,
      color: category.color,
    });
  }

  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const prevWeekSummary = summarizeReceipts(prevWeekReceipts);

  // カテゴリ別集計 Map（ループ内で db アクセスしない）
  const categoryMap = new Map<
    string,
    { name: string; color: string; total: number; count: number }
  >();

  const receiptsWithCategory: WeekSummaryWithCategories["receipts"] = [];

  for (const receipt of receipts) {
    const categoryIdStr = receipt.categoryId as string;
    const info = categoryInfoMap.get(categoryIdStr);
    const name = info?.name ?? "不明";
    const color = info?.color ?? "#AAB7C4";

    const catEntry = categoryMap.get(categoryIdStr);
    if (catEntry === undefined) {
      categoryMap.set(categoryIdStr, { name, color, total: receipt.amountYen, count: 1 });
    } else {
      catEntry.total += receipt.amountYen;
      catEntry.count += 1;
    }

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
    });
  }

  // カテゴリ別集計を金額降順にソート
  const byCategory: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      categoryColor: data.color,
      totalAmountYen: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.totalAmountYen - a.totalAmountYen);

  return {
    count,
    totalAmountYen,
    byCategory,
    prevWeekReceiptCount: prevWeekSummary.count,
    prevWeekTotalAmountYen: prevWeekSummary.count > 0 ? prevWeekSummary.totalAmountYen : null,
    receipts: receiptsWithCategory,
  };
}

export type FourWeeksSummaryData = {
  /** 直近4週分の集計データ。古い順（昇順）で返す */
  weeks: Array<{
    weekStartDate: string;
    totalAmountYen: number;
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

  // 基準週から3週前まで4週分を降順で収集し、最後に昇順に反転する
  const descWeeks: Array<{ weekStartDate: string; totalAmountYen: number }> = [];

  for (let i = 0; i < 4; i++) {
    const targetWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -i);
    const receipts = await getWeekSpendingEntries(ctx, groupId, targetWeekStartDate);
    const { totalAmountYen } = summarizeReceipts(receipts);
    descWeeks.push({ weekStartDate: targetWeekStartDate, totalAmountYen });
  }

  // 古い順（昇順）に並べ替え
  const weeks = descWeeks.reverse();

  const weekCount = weeks.filter((w) => w.totalAmountYen > 0).length;

  return { weeks, weekCount };
}

export type DailySpendingTrendData = {
  currentWeek: Array<{
    date: string;
    totalAmountYen: number;
  }>;
  previousWeek: Array<{
    date: string;
    totalAmountYen: number;
  }>;
};

type GetDailySpendingTrendArgs = {
  weekStartDate: string;
};

/** getDailySpendingTrend query の handler ロジック（テスト用に export） */
export async function getDailySpendingTrendHandler(
  ctx: QueryCtx,
  args: GetDailySpendingTrendArgs,
): Promise<DailySpendingTrendData> {
  const { groupId } = await requireGroupMembership(ctx);

  async function getTotalForDate(targetDate: string): Promise<number> {
    const receipts = await getDateSpendingEntries(ctx, groupId, targetDate);
    return receipts.reduce((sum, r) => sum + r.amountYen, 0);
  }

  const currentWeekStart = args.weekStartDate;
  const previousWeekStart = calculateRelativeWeekStartDate(args.weekStartDate, -1);

  const currentWeek: DailySpendingTrendData["currentWeek"] = [];
  const previousWeek: DailySpendingTrendData["previousWeek"] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(currentWeekStart, i);
    const previousDate = addDays(previousWeekStart, i);
    currentWeek.push({ date: currentDate, totalAmountYen: await getTotalForDate(currentDate) });
    previousWeek.push({ date: previousDate, totalAmountYen: await getTotalForDate(previousDate) });
  }

  return { currentWeek, previousWeek };
}

export type MonthlyExpensesSummary = {
  totalExpensesYen: number;
  monthlyIncome: number | null;
  remainingBalanceYen: number | null;
};

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
  const totalExpensesYen = monthlyReceipts.reduce((sum, r) => sum + r.amountYen, 0);

  // users テーブルから monthlyIncome を取得する
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  const monthlyIncome = user?.monthlyIncome ?? null;
  const remainingBalanceYen = monthlyIncome !== null ? monthlyIncome - totalExpensesYen : null;

  return {
    totalExpensesYen,
    monthlyIncome,
    remainingBalanceYen,
  };
}

export const getWeekSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryHandler,
});

export const getWeekSummaryWithCategories = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryWithCategoriesHandler,
});

export const getFourWeeksSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getFourWeeksSummaryHandler,
});

export const getDailySpendingTrend = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getDailySpendingTrendHandler,
});

export const getMonthlyExpensesSummary = query({
  args: {
    monthStartDate: v.string(),
  },
  handler: getMonthlyExpensesSummaryHandler,
});

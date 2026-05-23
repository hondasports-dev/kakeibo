import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuthenticatedUserId } from "./users";
import type { Id } from "./_generated/dataModel";
import { calculateRelativeWeekStartDate, calculateWeekStartDate } from "./utils";

// ---------------------------------------------------------------------------
// createReceipt
// ---------------------------------------------------------------------------

type CreateReceiptArgs = {
  date: string;
  shopName: string;
  amountYen: number;
  categoryId: Id<"categories">;
  memo?: string;
};

/** createReceipt mutation の handler ロジック（テスト用に export） */
export async function createReceiptHandler(ctx: MutationCtx, args: CreateReceiptArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  // categoryId の所有権チェック
  const category = await ctx.db.get(args.categoryId);
  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.userId !== userId) {
    throw new ConvexError("Category does not belong to the current user");
  }
  if (!category.isActive) {
    throw new ConvexError("Inactive category cannot be used for new receipts");
  }

  const now = Date.now();
  const weekStartDate = calculateWeekStartDate(args.date);

  const receiptId = await ctx.db.insert("receipts", {
    userId,
    date: args.date,
    shopName: args.shopName,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    memo: args.memo,
    weekStartDate,
    createdAt: now,
    updatedAt: now,
  });

  const receipt = await ctx.db.get(receiptId);
  if (receipt === null) {
    throw new ConvexError("Failed to retrieve created receipt");
  }
  return receipt;
}

export const createReceipt = mutation({
  args: {
    date: v.string(),
    shopName: v.string(),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    memo: v.optional(v.string()),
  },
  handler: createReceiptHandler,
});

// ---------------------------------------------------------------------------
// getReceiptsByWeek
// ---------------------------------------------------------------------------

type GetReceiptsByWeekArgs = {
  weekStartDate: string;
};

/** getReceiptsByWeek query の handler ロジック（テスト用に export） */
export async function getReceiptsByWeekHandler(ctx: QueryCtx, args: GetReceiptsByWeekArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", args.weekStartDate),
    )
    .order("desc")
    .take(200);
}

export const getReceiptsByWeek = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getReceiptsByWeekHandler,
});

// ---------------------------------------------------------------------------
// getReceiptsByDate
// ---------------------------------------------------------------------------

type GetReceiptsByDateArgs = {
  date: string;
};

/** getReceiptsByDate query の handler ロジック（テスト用に export） */
export async function getReceiptsByDateHandler(ctx: QueryCtx, args: GetReceiptsByDateArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_date", (q) => q.eq("userId", userId).eq("date", args.date))
    .take(50);
}

export const getReceiptsByDate = query({
  args: {
    date: v.string(),
  },
  handler: getReceiptsByDateHandler,
});

// ---------------------------------------------------------------------------
// updateReceipt
// ---------------------------------------------------------------------------

type UpdateReceiptArgs = {
  receiptId: Id<"receipts">;
  date?: string;
  shopName?: string;
  amountYen?: number;
  categoryId?: Id<"categories">;
  memo?: string;
};

/** updateReceipt mutation の handler ロジック（テスト用に export） */
export async function updateReceiptHandler(ctx: MutationCtx, args: UpdateReceiptArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.userId !== userId) {
    throw new ConvexError("Receipt does not belong to the current user");
  }

  // categoryId が指定された場合は所有権チェック
  if (args.categoryId !== undefined) {
    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.userId !== userId) {
      throw new ConvexError("Category does not belong to the current user");
    }
    if (!category.isActive && (args.categoryId as string) !== (receipt.categoryId as string)) {
      throw new ConvexError("Inactive category cannot be used for new receipts");
    }
  }

  const now = Date.now();
  const patch: Partial<{
    date: string;
    shopName: string;
    amountYen: number;
    categoryId: Id<"categories">;
    memo: string | undefined;
    weekStartDate: string;
    updatedAt: number;
  }> = { updatedAt: now };

  if (args.date !== undefined) {
    patch.date = args.date;
    patch.weekStartDate = calculateWeekStartDate(args.date);
  }
  if (args.shopName !== undefined) {
    patch.shopName = args.shopName;
  }
  if (args.amountYen !== undefined) {
    patch.amountYen = args.amountYen;
  }
  if (args.categoryId !== undefined) {
    patch.categoryId = args.categoryId;
  }
  if (args.memo !== undefined) {
    patch.memo = args.memo;
  }

  await ctx.db.patch(args.receiptId, patch);

  const updated = await ctx.db.get(args.receiptId);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated receipt");
  }
  return updated;
}

export const updateReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    date: v.optional(v.string()),
    shopName: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    memo: v.optional(v.string()),
  },
  handler: updateReceiptHandler,
});

// ---------------------------------------------------------------------------
// deleteReceipt
// ---------------------------------------------------------------------------

type DeleteReceiptArgs = {
  receiptId: Id<"receipts">;
};

/** deleteReceipt mutation の handler ロジック（テスト用に export） */
export async function deleteReceiptHandler(ctx: MutationCtx, args: DeleteReceiptArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.userId !== userId) {
    throw new ConvexError("Receipt does not belong to the current user");
  }

  await ctx.db.delete(args.receiptId);
}

export const deleteReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: deleteReceiptHandler,
});

// ---------------------------------------------------------------------------
// getWeekSummary
// ---------------------------------------------------------------------------

type GetWeekSummaryArgs = {
  weekStartDate: string;
};

async function getReceiptsForWeek(ctx: QueryCtx, userId: string, weekStartDate: string) {
  const receipts = [];
  const query = ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", weekStartDate),
    )
    .order("desc");

  for await (const receipt of query) {
    receipts.push(receipt);
  }

  return receipts;
}

function summarizeReceipts(receipts: Array<{ amountYen: number }>) {
  const count = receipts.length;
  const totalAmountYen = receipts.reduce((sum, r) => sum + r.amountYen, 0);
  return { count, totalAmountYen };
}

/** getWeekSummary query の handler ロジック（テスト用に export） */
export async function getWeekSummaryHandler(ctx: QueryCtx, args: GetWeekSummaryArgs) {
  const userId = await requireAuthenticatedUserId(ctx);

  const receipts = await getReceiptsForWeek(ctx, userId, args.weekStartDate);
  const prevWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -1);
  const prevWeekReceipts = await getReceiptsForWeek(ctx, userId, prevWeekStartDate);

  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const prevWeekSummary = summarizeReceipts(prevWeekReceipts);

  return {
    count,
    totalAmountYen,
    prevWeekReceiptCount: prevWeekSummary.count,
    prevWeekTotalAmountYen: prevWeekSummary.count > 0 ? prevWeekSummary.totalAmountYen : null,
  };
}

export const getWeekSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryHandler,
});

// ---------------------------------------------------------------------------
// getWeekSummaryWithCategories
// ---------------------------------------------------------------------------

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
    shopName: string;
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
  const userId = await requireAuthenticatedUserId(ctx);

  const receipts = await getReceiptsForWeek(ctx, userId, args.weekStartDate);
  const prevWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -1);
  const prevWeekReceipts = await getReceiptsForWeek(ctx, userId, prevWeekStartDate);

  const categoryIds = Array.from(new Set(receipts.map((receipt) => receipt.categoryId)));
  const categories = await Promise.all(categoryIds.map((categoryId) => ctx.db.get(categoryId)));

  // カテゴリ情報を id → {name, color} の Map に変換
  const categoryInfoMap = new Map<string, { name: string; color: string }>();
  for (const category of categories) {
    if (category === null || category.userId !== userId) {
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
    const color = info?.color ?? "#999999";

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
      shopName: receipt.shopName,
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

export const getWeekSummaryWithCategories = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getWeekSummaryWithCategoriesHandler,
});

// ---------------------------------------------------------------------------
// getFourWeeksSummary
// ---------------------------------------------------------------------------

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
  const userId = await requireAuthenticatedUserId(ctx);

  // 基準週から3週前まで4週分を降順で収集し、最後に昇順に反転する
  const descWeeks: Array<{ weekStartDate: string; totalAmountYen: number }> = [];

  for (let i = 0; i < 4; i++) {
    const targetWeekStartDate = calculateRelativeWeekStartDate(args.weekStartDate, -i);
    const receipts = await getReceiptsForWeek(ctx, userId, targetWeekStartDate);
    const { totalAmountYen } = summarizeReceipts(receipts);
    descWeeks.push({ weekStartDate: targetWeekStartDate, totalAmountYen });
  }

  // 古い順（昇順）に並べ替え
  const weeks = descWeeks.reverse();

  const weekCount = weeks.filter((w) => w.totalAmountYen > 0).length;

  return { weeks, weekCount };
}

export const getFourWeeksSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getFourWeeksSummaryHandler,
});

// ---------------------------------------------------------------------------
// deleteReceiptsByUser (internal mutation / E2E テストデータクリーンアップ専用)
// ---------------------------------------------------------------------------

/**
 * 指定ユーザーのレシートを全件削除する。
 *
 * この mutation は internalMutation として定義されており、外部クライアントから
 * 直接呼び出せない。E2E テスト用の HTTP エンドポイント（convex/http.ts）経由でのみ呼び出す。
 */
export const deleteReceiptsByUser = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user_id_and_week_start_date", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(receipts.map((r) => ctx.db.delete(r._id)));

    return { deletedCount: receipts.length };
  },
});

// ---------------------------------------------------------------------------
// getMonthlyExpensesSummary
// ---------------------------------------------------------------------------

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
  const userId = await requireAuthenticatedUserId(ctx);

  // 当月に属する全レシートを集計する
  // by_user_id_and_week_start_date インデックスで userId のみ絞り込み、
  // weekStartDate.startsWith(monthStartDate) でフィルタリングする
  const allReceipts = await ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_week_start_date", (q) => q.eq("userId", userId))
    .collect();

  const monthlyReceipts = allReceipts.filter((r) =>
    r.weekStartDate.startsWith(args.monthStartDate),
  );
  const totalExpensesYen = monthlyReceipts.reduce((sum, r) => sum + r.amountYen, 0);

  // users テーブルから monthlyIncome を取得する
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();

  const monthlyIncome = user?.monthlyIncome ?? null;
  const remainingBalanceYen =
    monthlyIncome !== null ? monthlyIncome - totalExpensesYen : null;

  return {
    totalExpensesYen,
    monthlyIncome,
    remainingBalanceYen,
  };
}

export const getMonthlyExpensesSummary = query({
  args: {
    monthStartDate: v.string(),
  },
  handler: getMonthlyExpensesSummaryHandler,
});

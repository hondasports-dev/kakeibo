import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "./groups";
import type { Doc, Id } from "./_generated/dataModel";
import { calculateRelativeWeekStartDate, calculateWeekStartDate } from "./utils";

type SpendingEntry = {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
};

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthEndDate(monthStartDate: string): string {
  const [yearStr, monthStr] = monthStartDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
}

function mapReceiptToSpendingEntry(receipt: {
  _id: string;
  date: string;
  type?: "expense" | "income";
  shopName?: string;
  bankName?: string;
  amountYen: number;
  categoryId: string;
  memo?: string;
}): SpendingEntry {
  return {
    _id: receipt._id,
    date: receipt.date,
    type: receipt.type,
    shopName: receipt.shopName,
    bankName: receipt.bankName,
    amountYen: receipt.amountYen,
    categoryId: receipt.categoryId,
    memo: receipt.memo,
  };
}

function mapExpenseEntryToSpendingEntry(expenseEntry: {
  _id: string;
  date: string;
  amount: number;
  categoryId: string;
  title: string;
  memo?: string;
  entryType: "expense" | "income";
}): SpendingEntry {
  return {
    _id: expenseEntry._id,
    date: expenseEntry.date,
    type: expenseEntry.entryType,
    shopName: expenseEntry.entryType === "expense" ? expenseEntry.title : undefined,
    bankName: expenseEntry.entryType === "income" ? expenseEntry.title : undefined,
    amountYen: expenseEntry.amount,
    categoryId: expenseEntry.categoryId,
    memo: expenseEntry.memo,
  };
}

async function getWeekSpendingEntries(ctx: QueryCtx, groupId: Id<"groups">, weekStartDate: string) {
  const weekEndDate = addDays(weekStartDate, 6);
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", weekStartDate).lte("date", weekEndDate),
    )) {
    expenseEntries.push(entry);
  }
  const expenseEntriesForWeek = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (expenseEntriesForWeek.length > 0) {
    return expenseEntriesForWeek.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", weekStartDate),
    )
    .order("desc")) {
    receipts.push(receipt);
  }

  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

async function getDateSpendingEntries(ctx: QueryCtx, groupId: Id<"groups">, date: string) {
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", date))) {
    expenseEntries.push(entry);
  }
  if (expenseEntries.length > 0) {
    return expenseEntries
      .filter((entry) => entry.entryType !== "income")
      .map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", date))) {
    receipts.push(receipt);
  }
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

async function getMonthSpendingEntries(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  monthStartDate: string,
) {
  const monthEndDate = getMonthEndDate(monthStartDate);
  const expenseEntries: Array<{
    _id: string;
    date: string;
    amount: number;
    categoryId: string;
    title: string;
    memo?: string;
    entryType: "expense" | "income";
  }> = [];
  for await (const entry of ctx.db
    .query("expenseEntries")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", monthStartDate).lte("date", monthEndDate),
    )) {
    expenseEntries.push(entry);
  }
  const monthExpenseEntries = expenseEntries.filter((entry) => entry.entryType !== "income");
  if (monthExpenseEntries.length > 0) {
    return monthExpenseEntries.map((entry) => mapExpenseEntryToSpendingEntry(entry));
  }

  const receipts: Array<{
    _id: string;
    date: string;
    type?: "expense" | "income";
    shopName?: string;
    bankName?: string;
    amountYen: number;
    categoryId: string;
    memo?: string;
  }> = [];
  for await (const receipt of ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) =>
      q.eq("groupId", groupId).gte("date", monthStartDate).lte("date", monthEndDate),
    )) {
    receipts.push(receipt);
  }
  return receipts
    .filter((receipt) => receipt.type !== "income")
    .map((receipt) => mapReceiptToSpendingEntry(receipt));
}

// ---------------------------------------------------------------------------
// createReceipt
// ---------------------------------------------------------------------------

type CreateReceiptArgs =
  | {
      type?: "expense";
      date: string;
      shopName: string;
      amountYen: number;
      categoryId: Id<"categories">;
      memo?: string;
    }
  | {
      type: "income";
      date: string;
      bankName: string;
      amountYen: number;
      categoryId: Id<"categories">;
      memo?: string;
    };

export async function insertReceiptForGroup(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  args: CreateReceiptArgs,
) {
  if (args.type !== "income" && !args.shopName) {
    throw new ConvexError("shopName is required for expense receipts");
  }
  if (args.type === "income" && !args.bankName) {
    throw new ConvexError("bankName is required for income receipts");
  }

  const category = await ctx.db.get(args.categoryId);
  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
  if (!category.isActive) {
    throw new ConvexError("Inactive category cannot be used for new receipts");
  }

  const now = Date.now();
  const weekStartDate = calculateWeekStartDate(args.date);

  return await ctx.db.insert("receipts", {
    groupId,
    date: args.date,
    type: args.type,
    shopName: args.type === "income" ? undefined : args.shopName,
    bankName: args.type === "income" ? args.bankName : undefined,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    memo: args.memo,
    weekStartDate,
    createdAt: now,
    updatedAt: now,
  });
}

/** createReceipt mutation の handler ロジック（テスト用に export） */
export async function createReceiptHandler(ctx: MutationCtx, args: CreateReceiptArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const receiptId = await insertReceiptForGroup(ctx, groupId, args);

  const receipt = await ctx.db.get(receiptId);
  if (receipt === null) {
    throw new ConvexError("Failed to retrieve created receipt");
  }
  return receipt;
}

export const createReceipt = mutation({
  args: {
    date: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    shopName: v.optional(v.string()),
    bankName: v.optional(v.string()),
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
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
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
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", args.date))
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
  const { groupId } = await requireGroupMembership(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.groupId !== groupId) {
    throw new ConvexError("Receipt does not belong to the current group");
  }

  // categoryId が指定された場合は所有権チェック
  if (args.categoryId !== undefined) {
    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.groupId !== groupId) {
      throw new ConvexError("Category does not belong to the current group");
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
  const { groupId } = await requireGroupMembership(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.groupId !== groupId) {
    throw new ConvexError("Receipt does not belong to the current group");
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

function summarizeReceipts(receipts: Array<{ amountYen: number }>) {
  const count = receipts.length;
  const totalAmountYen = receipts.reduce((sum, r) => sum + r.amountYen, 0);
  return { count, totalAmountYen };
}

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

export const getFourWeeksSummary = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getFourWeeksSummaryHandler,
});

// ---------------------------------------------------------------------------
// getDailySpendingTrend
// ---------------------------------------------------------------------------

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

export const getDailySpendingTrend = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getDailySpendingTrendHandler,
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
    groupId: v.id("groups"),
  },
  handler: async (ctx, { groupId }) => {
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId))
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

export const getMonthlyExpensesSummary = query({
  args: {
    monthStartDate: v.string(),
  },
  handler: getMonthlyExpensesSummaryHandler,
});

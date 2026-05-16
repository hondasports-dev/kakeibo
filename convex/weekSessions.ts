import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuthenticatedUserId } from "./users";
import { calculateWeekStartDate, calculateWeekEndDate } from "./utils";

// ---------------------------------------------------------------------------
// getOrCreateCurrentWeekSession
// ---------------------------------------------------------------------------

/** getOrCreateCurrentWeekSession mutation の handler ロジック（テスト用に export） */
export async function getOrCreateCurrentWeekSessionHandler(ctx: MutationCtx) {
  const userId = await requireAuthenticatedUserId(ctx);

  // 今日の日付を Date.now() から計算
  const today = new Date(Date.now());
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  const weekStartDate = calculateWeekStartDate(todayStr);
  const weekEndDate = calculateWeekEndDate(weekStartDate);

  // withIndex で userId + weekStartDate で検索、.unique() で取得
  const existing = await ctx.db
    .query("weekSessions")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", weekStartDate),
    )
    .unique();

  if (existing !== null) {
    return existing;
  }

  // 既存なし → status:"draft" で insert して返す
  const now = Date.now();
  const sessionId = await ctx.db.insert("weekSessions", {
    userId,
    weekStartDate,
    weekEndDate,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const session = await ctx.db.get(sessionId);
  if (session === null) {
    throw new ConvexError("Failed to retrieve created week session");
  }
  return session;
}

export const getOrCreateCurrentWeekSession = mutation({
  args: {},
  handler: getOrCreateCurrentWeekSessionHandler,
});

// ---------------------------------------------------------------------------
// getWeekSession
// ---------------------------------------------------------------------------

/** getWeekSession query の handler ロジック（テスト用に export） */
export async function getWeekSessionHandler(
  ctx: QueryCtx,
  args: { weekStartDate: string },
) {
  const userId = await requireAuthenticatedUserId(ctx);

  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  return session;
}

export const getWeekSession = query({
  args: { weekStartDate: v.string() },
  handler: getWeekSessionHandler,
});

// ---------------------------------------------------------------------------
// completeWeekSession
// ---------------------------------------------------------------------------

/** completeWeekSession mutation の handler ロジック（テスト用に export） */
export async function completeWeekSessionHandler(
  ctx: MutationCtx,
  args: { weekStartDate: string; reviewMemo?: string },
) {
  const userId = await requireAuthenticatedUserId(ctx);

  // 存在確認・所有権チェック
  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  if (session === null) {
    throw new ConvexError("Week session not found");
  }

  // status を completed に更新
  const now = Date.now();
  await ctx.db.patch(session._id, {
    status: "completed",
    reviewMemo: args.reviewMemo,
    updatedAt: now,
  });

  const updated = await ctx.db.get(session._id);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated week session");
  }
  return updated;
}

export const completeWeekSession = mutation({
  args: {
    weekStartDate: v.string(),
    reviewMemo: v.optional(v.string()),
  },
  handler: completeWeekSessionHandler,
});

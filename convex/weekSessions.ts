import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "./groups";
import { calculateWeekStartDate, calculateWeekEndDate } from "./utils";

// ---------------------------------------------------------------------------
// getOrCreateCurrentWeekSession
// ---------------------------------------------------------------------------

/** getOrCreateCurrentWeekSession mutation の handler ロジック（テスト用に export） */
export async function getOrCreateCurrentWeekSessionHandler(ctx: MutationCtx) {
  // 今日の日付を Date.now() から計算して今週の weekStartDate を求め、汎用 handler に委譲する
  const today = new Date(Date.now());
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  const weekStartDate = calculateWeekStartDate(todayStr);

  return getOrCreateWeekSessionHandler(ctx, { weekStartDate });
}

export const getOrCreateCurrentWeekSession = mutation({
  args: {},
  handler: getOrCreateCurrentWeekSessionHandler,
});

// ---------------------------------------------------------------------------
// getOrCreateWeekSession（任意週対応）
// ---------------------------------------------------------------------------

/** getOrCreateWeekSession mutation の handler ロジック（テスト用に export） */
export async function getOrCreateWeekSessionHandler(
  ctx: MutationCtx,
  args: { weekStartDate: string },
) {
  const { groupId } = await requireGroupMembership(ctx);

  const weekEndDate = calculateWeekEndDate(args.weekStartDate);

  const existing = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  if (existing !== null) {
    return existing;
  }

  const now = Date.now();
  const sessionId = await ctx.db.insert("weekSessions", {
    groupId,
    weekStartDate: args.weekStartDate,
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

export const getOrCreateWeekSession = mutation({
  args: { weekStartDate: v.string() },
  handler: getOrCreateWeekSessionHandler,
});

// ---------------------------------------------------------------------------
// getWeekSession
// ---------------------------------------------------------------------------

/** getWeekSession query の handler ロジック（テスト用に export） */
export async function getWeekSessionHandler(ctx: QueryCtx, args: { weekStartDate: string }) {
  const { groupId } = await requireGroupMembership(ctx);

  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  return session;
}

export const getWeekSession = query({
  args: { weekStartDate: v.string() },
  handler: getWeekSessionHandler,
});

// ---------------------------------------------------------------------------
// updateReviewMemo
// ---------------------------------------------------------------------------

/** updateReviewMemo mutation の handler ロジック（テスト用に export） */
export async function updateReviewMemoHandler(
  ctx: MutationCtx,
  args: { weekStartDate: string; reviewMemo: string },
) {
  const { groupId } = await requireGroupMembership(ctx);

  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  if (session === null) {
    throw new ConvexError("Week session not found");
  }

  await ctx.db.patch(session._id, {
    reviewMemo: args.reviewMemo,
    updatedAt: Date.now(),
  });

  const updated = await ctx.db.get(session._id);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated week session");
  }
  return updated;
}

export const updateReviewMemo = mutation({
  args: {
    weekStartDate: v.string(),
    reviewMemo: v.string(),
  },
  handler: updateReviewMemoHandler,
});

// ---------------------------------------------------------------------------
// completeWeekSession
// ---------------------------------------------------------------------------

/** completeWeekSession mutation の handler ロジック（テスト用に export） */
export async function completeWeekSessionHandler(
  ctx: MutationCtx,
  args: { weekStartDate: string; reviewMemo?: string },
) {
  const { groupId } = await requireGroupMembership(ctx);

  // 存在確認・所有権チェック
  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .unique();

  if (session === null) {
    throw new ConvexError("Week session not found");
  }

  // status を completed に更新
  // reviewMemo が undefined のとき patch に含めると既存フィールドが削除されるため、
  // 値が指定されている場合のみ patch データに含める。
  const now = Date.now();
  const patchData: { status: "completed"; updatedAt: number; reviewMemo?: string } = {
    status: "completed",
    updatedAt: now,
  };
  if (args.reviewMemo !== undefined) {
    patchData.reviewMemo = args.reviewMemo;
  }
  await ctx.db.patch(session._id, patchData);

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

// ---------------------------------------------------------------------------
// resetWeekSessionForGroup (internal mutation / E2E テストデータクリーンアップ専用)
// ---------------------------------------------------------------------------

/**
 * 指定グループ・指定週の週次セッションを draft に戻す。
 *
 * この mutation は internalMutation として定義されており、外部クライアントから
 * 直接呼び出せない。E2E テスト用の HTTP エンドポイント（convex/http.ts）経由でのみ呼び出す。
 */
export async function resetWeekSessionForUserHandler(
  ctx: MutationCtx,
  { groupId, weekStartDate }: { groupId: Id<"groups">; weekStartDate: string },
) {
  const session = await ctx.db
    .query("weekSessions")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", weekStartDate),
    )
    .unique();

  if (session === null) {
    return { reset: false };
  }

  await ctx.db.patch(session._id, {
    status: "draft",
    reviewMemo: undefined,
    updatedAt: Date.now(),
  });

  return { reset: true };
}

export const resetWeekSessionForUser = internalMutation({
  args: {
    groupId: v.id("groups"),
    weekStartDate: v.string(),
  },
  handler: resetWeekSessionForUserHandler,
});

import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireGroupMembership } from "../groups/membership";
import { calculateWeekStartDate, calculateWeekEndDate } from "../lib/weekDates";
import { getWeeklyStartDayForUser } from "../users/weeklySettings";

/** getOrCreateCurrentWeekSession mutation の handler ロジック（テスト用に export） */
export async function getOrCreateCurrentWeekSessionHandler(ctx: MutationCtx) {
  const { userId } = await requireGroupMembership(ctx);
  const today = new Date(Date.now());
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  const weekStartDay = await getWeeklyStartDayForUser(ctx, userId);
  const weekStartDate = calculateWeekStartDate(todayStr, weekStartDay);

  return getOrCreateWeekSessionHandler(ctx, { weekStartDate });
}

export const getOrCreateCurrentWeekSession = mutation({
  args: {},
  handler: getOrCreateCurrentWeekSessionHandler,
});

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

/** completeWeekSession mutation の handler ロジック（テスト用に export） */
export async function completeWeekSessionHandler(
  ctx: MutationCtx,
  args: { weekStartDate: string; reviewMemo?: string },
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

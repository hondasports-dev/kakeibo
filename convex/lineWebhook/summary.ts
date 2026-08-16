import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MAX_CATEGORIES_PER_GROUP } from "../../lib/domain/categories/defaults";
import { getTodayDateStringInJapan } from "../../lib/domain/common/date";
import {
  parseLineSummaryCommand,
  resolveCategoryLookup,
} from "../../lib/domain/lineSummary/commands";
import type { LineReplyKind } from "../../lib/domain/lineSummary/quickReply";
import {
  LINE_HELP_MESSAGE,
  LINE_NO_GROUP_MESSAGE,
  LINE_RECEIPT_GUIDE_MESSAGE,
  LINE_UNRESOLVED_GROUP_MESSAGE,
  formatCategoryReply,
  formatWeekCategoriesReply,
  formatWeekExpenseReply,
  formatWeekIncomeReply,
  formatWeekSummaryReply,
  formatWeekTrendReply,
} from "../../lib/domain/lineSummary/reply";
import {
  calculateRelativeWeekStartDate,
  calculateWeekStartDate,
} from "../../lib/domain/week/weekDates";
import {
  buildCategoryInfoMap,
  summarizeByCategory,
  summarizeReceipts,
} from "../../lib/convex/receipts/summaryLib/categoryAggregation";
import { getWeekIncomeEntries, getWeekSpendingEntries } from "../receipts/spendingEntries";
import { isGroupDeleted } from "../groups/lib/groupLifecycle";
import type { GroupDoc } from "../groups/lib/groupTypes";
import { resolveActiveGroupForUserId } from "../groups/membership";
import { getWeeklyStartDayForUser } from "../users/weeklySettings";
import { LINE_UNLINKED_GUIDANCE_MESSAGE } from "./client";

const lineReplyKindValidator = v.union(
  v.literal("unlinked"),
  v.literal("unavailable"),
  v.literal("no_group"),
  v.literal("unresolved"),
  v.literal("help"),
  v.literal("week_summary"),
  v.literal("week_expense"),
  v.literal("week_income"),
  v.literal("week_categories"),
  v.literal("week_trend"),
  v.literal("category_lookup"),
  v.literal("receipt_guide"),
);

const summaryReplyValidator = v.object({
  replyText: v.string(),
  replyKind: lineReplyKindValidator,
});

async function hasUniqueActiveLineLink(ctx: QueryCtx, userId: string): Promise<boolean> {
  const activeLinks = await ctx.db
    .query("lineAccountLinks")
    .withIndex("by_user_id_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .take(2);
  return activeLinks.length === 1;
}

async function loadWeekSummary(ctx: QueryCtx, groupId: Id<"groups">, weekStartDate: string) {
  const receipts = await getWeekSpendingEntries(ctx, groupId, weekStartDate);
  const categoryIds = Array.from(new Set(receipts.map((receipt) => receipt.categoryId)));
  const categoryInfoMap = await buildCategoryInfoMap(ctx, groupId, categoryIds);
  const { count, totalAmountYen } = summarizeReceipts(receipts);
  const incomeEntries = await getWeekIncomeEntries(ctx, groupId, weekStartDate);
  return {
    weekStartDate,
    expenseCount: count,
    expenseTotalYen: totalAmountYen,
    incomeCount: incomeEntries.length,
    incomeTotalYen: incomeEntries.reduce((sum, entry) => sum + entry.amountYen, 0),
    byCategory: summarizeByCategory(receipts, categoryInfoMap),
  };
}

async function loadTrendWeeks(ctx: QueryCtx, groupId: Id<"groups">, weekStartDate: string) {
  const weeks = [];
  for (let i = 3; i >= 0; i -= 1) {
    const targetWeekStartDate = calculateRelativeWeekStartDate(weekStartDate, -i);
    const receipts = await getWeekSpendingEntries(ctx, groupId, targetWeekStartDate);
    const { totalAmountYen } = summarizeReceipts(receipts);
    weeks.push({ weekStartDate: targetWeekStartDate, totalAmountYen });
  }
  return weeks;
}

async function loadActiveCategories(ctx: QueryCtx, groupId: Id<"groups">) {
  return await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_is_active_and_sort_order", (q) =>
      q.eq("groupId", groupId).eq("isActive", true),
    )
    .take(MAX_CATEGORIES_PER_GROUP);
}

function reply(replyKind: LineReplyKind, replyText: string) {
  return { replyKind, replyText };
}

export async function buildSummaryReplyHandler(
  ctx: QueryCtx,
  args: { userId: string; messageText: string; nowMs: number },
): Promise<{ replyText: string; replyKind: LineReplyKind }> {
  if (!(await hasUniqueActiveLineLink(ctx, args.userId))) {
    return reply("unlinked", LINE_UNLINKED_GUIDANCE_MESSAGE);
  }

  const command = parseLineSummaryCommand(args.messageText);
  if (command.type === "help") {
    return reply("help", LINE_HELP_MESSAGE);
  }
  if (command.type === "receipt_guide") {
    return reply("receipt_guide", LINE_RECEIPT_GUIDE_MESSAGE);
  }

  const groupResolution = await resolveActiveGroupForUserId(ctx, args.userId);
  if (groupResolution.status === "no_group") {
    return reply("no_group", LINE_NO_GROUP_MESSAGE);
  }
  if (groupResolution.status === "unresolved") {
    return reply("unresolved", LINE_UNRESOLVED_GROUP_MESSAGE);
  }

  const groupId = groupResolution.membership.groupId;
  const group = (await ctx.db.get(groupId)) as GroupDoc | null;
  if (group === null || isGroupDeleted(group)) {
    return reply("no_group", LINE_NO_GROUP_MESSAGE);
  }

  const weekStartDay = await getWeeklyStartDayForUser(ctx, args.userId);
  const today = getTodayDateStringInJapan(args.nowMs);
  const weekStartDate = calculateWeekStartDate(today, weekStartDay);
  const weekSummary = await loadWeekSummary(ctx, groupId, weekStartDate);

  if (command.type === "week_expense") {
    return reply("week_expense", formatWeekExpenseReply(weekSummary));
  }
  if (command.type === "week_income") {
    return reply("week_income", formatWeekIncomeReply(weekSummary));
  }
  if (command.type === "week_categories") {
    return reply("week_categories", formatWeekCategoriesReply(weekSummary));
  }
  if (command.type === "week_trend") {
    const weeks = await loadTrendWeeks(ctx, groupId, weekStartDate);
    return reply("week_trend", formatWeekTrendReply({ weeks }));
  }
  if (command.type === "category_lookup") {
    const categories = await loadActiveCategories(ctx, groupId);
    const category = resolveCategoryLookup(command.name, categories);
    if (category === undefined) {
      return reply("help", LINE_HELP_MESSAGE);
    }
    const matched = weekSummary.byCategory.find((entry) => entry.categoryId === category._id);
    return reply("category_lookup", formatCategoryReply(weekSummary, category.name, matched));
  }

  return reply("week_summary", formatWeekSummaryReply(weekSummary));
}

export const buildReply = internalQuery({
  args: {
    userId: v.string(),
    messageText: v.string(),
    nowMs: v.number(),
  },
  returns: summaryReplyValidator,
  handler: buildSummaryReplyHandler,
});

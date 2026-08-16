import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MAX_CATEGORIES_PER_GROUP } from "../../lib/domain/categories/defaults";
import { getTodayDateStringInJapan } from "../../lib/domain/common/date";
import { parseLineSummaryCommand } from "../../lib/domain/lineSummary/commands";
import {
  LINE_HELP_MESSAGE,
  LINE_NO_GROUP_MESSAGE,
  LINE_UNRESOLVED_GROUP_MESSAGE,
  formatCategoryReply,
  formatUnknownCategoryReply,
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
import { resolveActiveGroupForUserId } from "../groups/membership";
import { getWeeklyStartDayForUser } from "../users/weeklySettings";
import { LINE_UNLINKED_GUIDANCE_MESSAGE } from "./client";

const summaryReplyValidator = v.object({
  replyText: v.string(),
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

async function findActiveCategoryByName(ctx: QueryCtx, groupId: Id<"groups">, name: string) {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_is_active_and_sort_order", (q) =>
      q.eq("groupId", groupId).eq("isActive", true),
    )
    .take(MAX_CATEGORIES_PER_GROUP);
  return categories.find((category) => category.name === name);
}

export async function buildSummaryReplyHandler(
  ctx: QueryCtx,
  args: { userId: string; messageText: string; nowMs: number },
): Promise<{ replyText: string }> {
  if (!(await hasUniqueActiveLineLink(ctx, args.userId))) {
    return { replyText: LINE_UNLINKED_GUIDANCE_MESSAGE };
  }

  const command = parseLineSummaryCommand(args.messageText);
  if (command.type === "help") {
    return { replyText: LINE_HELP_MESSAGE };
  }

  const groupResolution = await resolveActiveGroupForUserId(ctx, args.userId);
  if (groupResolution.status === "no_group") {
    return { replyText: LINE_NO_GROUP_MESSAGE };
  }
  if (groupResolution.status === "unresolved") {
    return { replyText: LINE_UNRESOLVED_GROUP_MESSAGE };
  }

  const groupId = groupResolution.membership.groupId;
  const weekStartDay = await getWeeklyStartDayForUser(ctx, args.userId);
  const today = getTodayDateStringInJapan(args.nowMs);
  const weekStartDate = calculateWeekStartDate(today, weekStartDay);
  const weekSummary = await loadWeekSummary(ctx, groupId, weekStartDate);

  if (command.type === "week_expense") {
    return { replyText: formatWeekExpenseReply(weekSummary) };
  }
  if (command.type === "week_income") {
    return { replyText: formatWeekIncomeReply(weekSummary) };
  }
  if (command.type === "week_categories") {
    return { replyText: formatWeekCategoriesReply(weekSummary) };
  }
  if (command.type === "week_trend") {
    const weeks = await loadTrendWeeks(ctx, groupId, weekStartDate);
    return { replyText: formatWeekTrendReply({ weeks }) };
  }
  if (command.type === "category_lookup") {
    const category = await findActiveCategoryByName(ctx, groupId, command.name);
    if (category === undefined) {
      return { replyText: formatUnknownCategoryReply(command.name) };
    }
    const matched = weekSummary.byCategory.find((entry) => entry.categoryId === category._id);
    return { replyText: formatCategoryReply(weekSummary, command.name, matched) };
  }

  return { replyText: formatWeekSummaryReply(weekSummary) };
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

// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";
import { LINE_UNLINKED_GUIDANCE_MESSAGE } from "./client";
import {
  LINE_HELP_MESSAGE,
  LINE_NO_GROUP_MESSAGE,
  LINE_UNRESOLVED_GROUP_MESSAGE,
} from "../../lib/domain/lineSummary/reply";

const NOW_MS = Date.parse("2026-08-12T12:00:00+09:00");

async function seedLinkedHousehold(
  t: ReturnType<typeof convexTest>,
  options: {
    userId: string;
    lineUserId: string;
    groupName: string;
    active?: boolean;
    extraGroup?: boolean;
  },
) {
  return t.run(async (ctx) => {
    const groupId = await ctx.db.insert("groups", {
      name: options.groupName,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherGroupId = await ctx.db.insert("groups", {
      name: `${options.groupName}-other`,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("users", {
      userId: options.userId,
      displayName: options.userId,
      createdAt: 1,
      updatedAt: 1,
      ...(options.active === false ? {} : { activeGroupId: groupId }),
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: options.userId,
      role: "owner",
      createdAt: 1,
      updatedAt: 1,
    });
    if (options.extraGroup) {
      await ctx.db.insert("groupMembers", {
        groupId: otherGroupId,
        userId: options.userId,
        role: "member",
        createdAt: 1,
        updatedAt: 1,
      });
    }
    await ctx.db.insert("lineAccountLinks", {
      userId: options.userId,
      lineUserId: options.lineUserId,
      status: "active",
      linkedAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    const foodId = await ctx.db.insert("categories", {
      groupId,
      name: "食費",
      color: "#f97316",
      isActive: true,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    const dailyId = await ctx.db.insert("categories", {
      groupId,
      name: "日用品",
      color: "#0ea5e9",
      isActive: true,
      sortOrder: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    const otherFoodId = await ctx.db.insert("categories", {
      groupId: otherGroupId,
      name: "食費",
      color: "#111111",
      isActive: true,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-08-11",
      amount: 2000,
      categoryId: foodId,
      title: "牛乳",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-08-11",
      amount: 1000,
      categoryId: dailyId,
      title: "洗剤",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-08-11",
      amount: 180000,
      title: "給与",
      entryType: "income",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-08-04",
      amount: 500,
      categoryId: foodId,
      title: "先週のパン",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-07-28",
      amount: 400,
      categoryId: foodId,
      title: "2週前の野菜",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId: otherGroupId,
      date: "2026-08-11",
      amount: 99999,
      categoryId: otherFoodId,
      title: "別グループの秘密",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    return { groupId, otherGroupId, foodId };
  });
}

describe("LINE readonly summary", () => {
  it("連携済みユーザーの今週サマリーは本人のactiveグループだけを返す", async () => {
    const t = convexTest(schema, convexTestModules);
    await seedLinkedHousehold(t, {
      userId: "user-a",
      lineUserId: "line-a",
      groupName: "A家",
    });
    await seedLinkedHousehold(t, {
      userId: "user-b",
      lineUserId: "line-b",
      groupName: "B家",
    });

    const reply = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "今週",
      nowMs: NOW_MS,
    });

    expect(reply.replyText).toContain("支出: 3,000円");
    expect(reply.replyText).toContain("収入: 180,000円");
    expect(reply.replyText).toContain("食費 2,000円");
    expect(reply.replyText).not.toContain("99,999");
    expect(reply.replyText).not.toContain("別グループの秘密");
  });

  it("未連携相当のuserIdには案内だけを返し家計金額を出さない", async () => {
    const t = convexTest(schema, convexTestModules);
    const reply = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "missing-user",
      messageText: "今週の支出",
      nowMs: NOW_MS,
    });
    expect(reply.replyText).toBe(LINE_UNLINKED_GUIDANCE_MESSAGE);
    expect(reply.replyText).not.toContain("円");
  });

  it("コマンドごとに支出・収入・カテゴリ別・週別推移・食費を返す", async () => {
    const t = convexTest(schema, convexTestModules);
    await seedLinkedHousehold(t, {
      userId: "user-a",
      lineUserId: "line-a",
      groupName: "A家",
    });

    const expense = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "今週の支出",
      nowMs: NOW_MS,
    });
    const income = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "今週の収入",
      nowMs: NOW_MS,
    });
    const categories = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "カテゴリ別",
      nowMs: NOW_MS,
    });
    const food = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "食費",
      nowMs: NOW_MS,
    });
    const trend = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "週別推移",
      nowMs: NOW_MS,
    });

    expect(expense.replyText).toContain("支出: 3,000円");
    expect(income.replyText).toContain("収入: 180,000円");
    expect(categories.replyText).toContain("食費 2,000円");
    expect(food.replyText).toContain("食費: 2,000円");
    expect(trend.replyText).toContain("直近3週間の支出");
    expect(trend.replyText).toContain("400円");
    expect(trend.replyText).toContain("500円");
    expect(trend.replyText).toContain("3,000円");
    expect(trend.replyText).not.toContain("99,999");
  });

  it("未知コマンドとグループ未設定・未選択は金額を返さない", async () => {
    const t = convexTest(schema, convexTestModules);
    await seedLinkedHousehold(t, {
      userId: "user-a",
      lineUserId: "line-a",
      groupName: "A家",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("lineAccountLinks", {
        userId: "user-nogroup",
        lineUserId: "line-nogroup",
        status: "active",
        linkedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "user-nogroup",
        displayName: "no-group",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    await seedLinkedHousehold(t, {
      userId: "user-multi",
      lineUserId: "line-multi",
      groupName: "複数所属",
      active: false,
      extraGroup: true,
    });

    const unknown = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "旅行",
      nowMs: NOW_MS,
    });
    const help = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-a",
      messageText: "ヘルプ",
      nowMs: NOW_MS,
    });
    const noGroup = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-nogroup",
      messageText: "今週の支出",
      nowMs: NOW_MS,
    });
    const unresolved = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-multi",
      messageText: "今週の支出",
      nowMs: NOW_MS,
    });

    expect(unknown.replyText).toContain(LINE_HELP_MESSAGE);
    expect(unknown.replyText).not.toMatch(/\d+円/);
    expect(help.replyText).toBe(LINE_HELP_MESSAGE);
    expect(noGroup.replyText).toBe(LINE_NO_GROUP_MESSAGE);
    expect(unresolved.replyText).toBe(LINE_UNRESOLVED_GROUP_MESSAGE);
  });

  it("データが無い週は専用の空メッセージを返す", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "空グループ",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "user-empty",
        displayName: "empty",
        createdAt: 1,
        updatedAt: 1,
        activeGroupId: groupId,
      });
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: "user-empty",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("lineAccountLinks", {
        userId: "user-empty",
        lineUserId: "line-empty",
        status: "active",
        linkedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const reply = await t.query(internal.lineWebhook.summary.buildReply, {
      userId: "user-empty",
      messageText: "今週",
      nowMs: NOW_MS,
    });
    expect(reply.replyText).toBe("今週（2026-08-10〜2026-08-16）の家計データはありません。");
  });
});

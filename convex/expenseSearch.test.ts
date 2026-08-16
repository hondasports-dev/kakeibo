// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { convexTestModules } from "./test.setup";

const identity = (userId: string) => ({
  tokenIdentifier: userId,
  subject: `clerk-${userId}`,
  issuer: "https://issuer.example",
  email: `${userId}@example.test`,
});

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const groupId = await ctx.db.insert("groups", {
      name: "検索グループ",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherGroupId = await ctx.db.insert("groups", {
      name: "別グループ",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("users", {
      userId: "search-user",
      displayName: "検索ユーザー",
      createdAt: 1,
      updatedAt: 1,
      activeGroupId: groupId,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: "search-user",
      role: "owner",
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
    const sourceDocumentId = await ctx.db.insert("sourceDocuments", {
      groupId,
      sourceType: "manual",
      status: "finalized",
      date: "2026-07-18",
      totalAmount: 3000,
      shopName: "スーパー北浜",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId,
      date: "2026-07-18",
      amount: 200,
      categoryId: foodId,
      title: "牛乳",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId,
      date: "2026-07-18",
      amount: 2800,
      categoryId: dailyId,
      title: "洗剤",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-06-01",
      amount: 540,
      categoryId: foodId,
      title: "セブンイレブン",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId,
      date: "2026-05-10",
      amount: 180000,
      title: "給与",
      entryType: "income",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("expenseEntries", {
      groupId: otherGroupId,
      date: "2026-07-18",
      amount: 9999,
      categoryId: otherFoodId,
      title: "別グループ店",
      entryType: "expense",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    });
    return { groupId, foodId, dailyId };
  });
}

describe("searchExpenses", () => {
  it("未ログインなら拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    await expect(
      t.query(api.expenseSearch.searchExpenses, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("店名の部分一致でレシート単位の明細を返す", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    const result = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        shopQuery: "北浜",
        paginationOpts: { numItems: 20, cursor: null },
      });

    expect(result.matchedGroupCount).toBe(1);
    expect(result.page).toHaveLength(2);
    expect(result.page.every((item) => item.receiptShopName === "スーパー北浜")).toBe(true);
    expect(result.page.map((item) => item.itemName).sort()).toEqual(["洗剤", "牛乳"]);
  });

  it("カテゴリ一致でもレシート全体を展開する", async () => {
    const t = convexTest(schema, convexTestModules);
    const ids = await seed(t);
    const result = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        categoryId: ids.dailyId,
        paginationOpts: { numItems: 20, cursor: null },
      });

    expect(result.matchedGroupCount).toBe(1);
    expect(result.page).toHaveLength(2);
    expect(result.page.map((item) => item.categoryName).sort()).toEqual(["日用品", "食費"]);
  });

  it("金額・日付で絞り込み、収入と他グループを除外する", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    const result = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        minAmountYen: 500,
        maxAmountYen: 600,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        paginationOpts: { numItems: 20, cursor: null },
      });

    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      shopName: "セブンイレブン",
      amountYen: 540,
    });
    expect(result.page.some((item) => item.shopName === "給与")).toBe(false);
    expect(result.page.some((item) => item.shopName === "別グループ店")).toBe(false);
  });

  it("金額範囲が不正ならエラーにする", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    await expect(
      t.withIdentity(identity("search-user")).query(api.expenseSearch.searchExpenses, {
        minAmountYen: 200,
        maxAmountYen: 100,
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow("金額の下限は上限以下にしてください");
  });

  it("グループ未所属なら拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    await expect(
      t.withIdentity(identity("stranger")).query(api.expenseSearch.searchExpenses, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow("グループに所属していません");
  });

  it("結果を日付の新しい順でページングする", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    const first = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 1, cursor: null },
      });
    expect(first.page[0]?.receiptShopName ?? first.page[0]?.shopName).toBe("スーパー北浜");
    expect(first.isDone).toBe(false);

    const second = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 1, cursor: first.continueCursor },
      });
    expect(second.page[0]?.shopName).toBe("セブンイレブン");
    expect(second.isDone).toBe(true);
  });

  it("100件を超える結果でも安定したカーソルで重複なく続きが取れる", async () => {
    const t = convexTest(schema, convexTestModules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("expenseEntries", {
          groupId: ids.groupId,
          date: "2026-01-01",
          amount: index + 1,
          categoryId: ids.foodId,
          title: `大量データ${index}`,
          entryType: "expense",
          source: "manual",
          createdAt: index + 1,
          updatedAt: index + 1,
        });
      }
    });

    const first = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 100, cursor: null },
      });
    const second = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 100, cursor: first.continueCursor },
      });

    const idsFromPages = [...first.page, ...second.page].map((item) => item._id);
    expect(first.matchedGroupCount).toBe(103);
    expect(first.page.length).toBeGreaterThanOrEqual(100);
    expect(second.page.length).toBeGreaterThan(0);
    expect(new Set(idsFromPages).size).toBe(idsFromPages.length);
    expect(second.isDone).toBe(true);
  });

  it("他グループのカテゴリでは0件を返す", async () => {
    const t = convexTest(schema, convexTestModules);
    const ids = await seed(t);
    const otherCategoryId = await t.run(async (ctx) => {
      const otherGroupId = await ctx.db.insert("groups", {
        name: "カテゴリ確認用",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("categories", {
        groupId: otherGroupId,
        name: "別食費",
        color: "#000000",
        isActive: true,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const result = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        categoryId: otherCategoryId,
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(result).toMatchObject({ page: [], matchedGroupCount: 0, isDone: true });
    expect(ids.foodId).toBeTruthy();
  });

  it("存在しないカテゴリでは0件を返す", async () => {
    const t = convexTest(schema, convexTestModules);
    const missingCategoryId = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "削除カテゴリ用",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      const categoryId = await ctx.db.insert("categories", {
        groupId,
        name: "消す",
        color: "#000000",
        isActive: true,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.delete(categoryId);
      return categoryId;
    });
    await seed(t);

    const result = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        categoryId: missingCategoryId,
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(result.page).toEqual([]);
  });

  it("開始日のみ・終了日のみでも絞り込める", async () => {
    const t = convexTest(schema, convexTestModules);
    await seed(t);
    const fromJuly = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        startDate: "2026-07-01",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(fromJuly.page.every((item) => item.date >= "2026-07-01")).toBe(true);

    const untilJune = await t
      .withIdentity(identity("search-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        endDate: "2026-06-30",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(untilJune.page.every((item) => item.date <= "2026-06-30")).toBe(true);
    expect(untilJune.page.some((item) => item.shopName === "セブンイレブン")).toBe(true);
  });

  it("expenseEntriesが無いグループでは旧receiptsを検索する", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "旧レシートグループ",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "legacy-user",
        displayName: "旧ユーザー",
        createdAt: 1,
        updatedAt: 1,
        activeGroupId: groupId,
      });
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: "legacy-user",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
      const categoryId = await ctx.db.insert("categories", {
        groupId,
        name: "食費",
        color: "#f97316",
        isActive: true,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("receipts", {
        groupId,
        date: "2026-04-02",
        type: "expense",
        shopName: "旧スーパー",
        amountYen: 880,
        categoryId,
        weekStartDate: "2026-03-30",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const result = await t
      .withIdentity(identity("legacy-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        shopQuery: "旧スーパー",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({ shopName: "旧スーパー", amountYen: 880 });

    const ranged = await t
      .withIdentity(identity("legacy-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(ranged.page).toHaveLength(1);

    const fromOnly = await t
      .withIdentity(identity("legacy-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        startDate: "2026-04-01",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(fromOnly.page).toHaveLength(1);

    const untilOnly = await t
      .withIdentity(identity("legacy-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        endDate: "2026-04-30",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(untilOnly.page).toHaveLength(1);
  });

  it("支出と収入を統合し、種別フィルターで切り替えられる", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "収入のみ",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "income-user",
        displayName: "収入ユーザー",
        createdAt: 1,
        updatedAt: 1,
        activeGroupId: groupId,
      });
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: "income-user",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("expenseEntries", {
        groupId,
        date: "2026-04-02",
        amount: 200000,
        title: "給与",
        entryType: "income",
        source: "manual",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const result = await t
      .withIdentity(identity("income-user"))
      .query(api.expenseSearch.searchExpenses, {
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({ type: "income", amountYen: 200000 });
    expect(result.totalIncomeYen).toBe(200000);

    const expensesOnly = await t
      .withIdentity(identity("income-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(expensesOnly.page).toEqual([]);

    const incomesOnly = await t
      .withIdentity(identity("income-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "income",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(incomesOnly.page).toHaveLength(1);
  });

  it("カテゴリマスタが無い明細は不明として返す", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "不明カテゴリ",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("users", {
        userId: "orphan-cat-user",
        displayName: "不明カテゴリユーザー",
        createdAt: 1,
        updatedAt: 1,
        activeGroupId: groupId,
      });
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: "orphan-cat-user",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
      const categoryId = await ctx.db.insert("categories", {
        groupId,
        name: "消す",
        color: "#111111",
        isActive: true,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("expenseEntries", {
        groupId,
        date: "2026-04-02",
        amount: 300,
        categoryId,
        title: "迷子店",
        entryType: "expense",
        source: "manual",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.delete(categoryId);
    });

    const result = await t
      .withIdentity(identity("orphan-cat-user"))
      .query(api.expenseSearch.searchExpenses, {
        entryType: "expense",
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect(result.page[0]).toMatchObject({
      shopName: "迷子店",
      categoryName: "不明",
      categoryColor: "#AAB7C4",
    });
  });
});

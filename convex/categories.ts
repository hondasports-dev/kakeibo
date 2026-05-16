import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuthenticatedUserId } from "./users";

const DEFAULT_CATEGORIES = [
  { name: "食費",   color: "#FF6B6B", sortOrder: 1 },
  { name: "日用品", color: "#4ECDC4", sortOrder: 2 },
  { name: "外食",   color: "#FFE66D", sortOrder: 3 },
  { name: "交通",   color: "#95E1D3", sortOrder: 4 },
  { name: "医療",   color: "#F38181", sortOrder: 5 },
  { name: "娯楽",   color: "#AA96DA", sortOrder: 6 },
  { name: "衣服",   color: "#FCBAD3", sortOrder: 7 },
  { name: "その他", color: "#A8DADC", sortOrder: 8 },
] as const;

/** seedDefaultCategories mutation の handler ロジック（テスト用に export） */
export async function seedDefaultCategoriesHandler(ctx: MutationCtx) {
  const userId = await requireAuthenticatedUserId(ctx);
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const category of DEFAULT_CATEGORIES) {
    // 同じ userId・isActive=true・同じ sortOrder のカテゴリが既存かチェック
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user_id_and_is_active_and_sort_order", (q) =>
        q.eq("userId", userId).eq("isActive", true).eq("sortOrder", category.sortOrder),
      )
      .unique();

    if (existing !== null) {
      skipped++;
      continue;
    }

    await ctx.db.insert("categories", {
      userId,
      name: category.name,
      color: category.color,
      isActive: true,
      sortOrder: category.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }

  return { created, skipped };
}

/** listActive query の handler ロジック（テスト用に export） */
export async function listActiveHandler(ctx: QueryCtx) {
  const userId = await requireAuthenticatedUserId(ctx);

  return await ctx.db
    .query("categories")
    .withIndex("by_user_id_and_is_active_and_sort_order", (q) =>
      q.eq("userId", userId).eq("isActive", true),
    )
    .order("asc")
    .collect();
}

/**
 * 初回ログイン時にデフォルトカテゴリを seed する mutation。
 * userId はサーバー側で identity.tokenIdentifier から解決するため、
 * クライアントから userId を渡さない。
 */
export const seedDefaultCategories = mutation({
  args: {},
  handler: seedDefaultCategoriesHandler,
});

/**
 * ログインユーザーのアクティブなカテゴリを sortOrder 昇順で返す query。
 * userId はサーバー側で identity.tokenIdentifier から解決するため、
 * クライアントから userId を渡さない。
 */
export const listActive = query({
  args: {},
  handler: listActiveHandler,
});

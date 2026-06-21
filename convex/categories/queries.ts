import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireGroupMembership } from "../groups/membership";
import { MAX_CATEGORIES_PER_GROUP } from "./mutations";

/** listActive query の handler ロジック（テスト用に export） */
export async function listActiveHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_is_active_and_sort_order", (q) =>
      q.eq("groupId", groupId).eq("isActive", true),
    )
    .order("asc")
    .collect();
}

/** listForSettings query の handler ロジック（テスト用に export） */
export async function listForSettingsHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
    .order("asc")
    .take(MAX_CATEGORIES_PER_GROUP);
}

/**
 * ログインユーザーのグループのアクティブなカテゴリを sortOrder 昇順で返す query。
 * groupId はサーバー側でグループメンバーシップから解決するため、
 * クライアントから groupId を渡さない。
 */
export const listActive = query({
  args: {},
  handler: listActiveHandler,
});

/**
 * カテゴリ設定画面用に、無効化済みを含むカテゴリを sortOrder 昇順で返す。
 * 既存 receipt は categoryId 参照を維持するため、カテゴリは削除せず無効化する。
 */
export const listForSettings = query({
  args: {},
  handler: listForSettingsHandler,
});

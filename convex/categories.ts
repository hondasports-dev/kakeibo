import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireGroupMembership } from "./groups";

const DEFAULT_CATEGORIES = [
  { name: "食費", color: "#8B5E3C", sortOrder: 1 },
  { name: "日用品", color: "#A6B28B", sortOrder: 2 },
  { name: "外食", color: "#F4A27A", sortOrder: 3 },
  { name: "交通", color: "#AAB7C4", sortOrder: 4 },
  { name: "医療", color: "#C9734B", sortOrder: 5 },
  { name: "娯楽", color: "#6F7F55", sortOrder: 6 },
  { name: "衣服", color: "#D8B28F", sortOrder: 7 },
  { name: "その他", color: "#765F4F", sortOrder: 8 },
] as const;

const LEGACY_DEFAULT_CATEGORY_COLORS_BY_SORT_ORDER = new Map<number, string>([
  [1, "#FF6B6B"],
  [2, "#4ECDC4"],
  [3, "#FFE66D"],
  [4, "#95E1D3"],
  [5, "#F38181"],
  [6, "#AA96DA"],
  [7, "#FCBAD3"],
  [8, "#A8DADC"],
]);

const MAX_CATEGORIES_PER_GROUP = 100;
const E2E_CATEGORY_NAME_PREFIX = "E2Eカテゴリ-";

function shouldRefreshLegacyDefaultCategoryColor(
  existing: { name: string; color: string; sortOrder: number },
  nextDefault: (typeof DEFAULT_CATEGORIES)[number],
) {
  const legacyColor = LEGACY_DEFAULT_CATEGORY_COLORS_BY_SORT_ORDER.get(existing.sortOrder);
  return (
    existing.name === nextDefault.name &&
    existing.sortOrder === nextDefault.sortOrder &&
    existing.color.toUpperCase() === legacyColor
  );
}

/** seedDefaultCategories mutation の handler ロジック（テスト用に export） */
export async function seedDefaultCategoriesHandler(ctx: MutationCtx) {
  const { groupId } = await requireGroupMembership(ctx);
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const category of DEFAULT_CATEGORIES) {
    // 無効化済みのデフォルトカテゴリを、次回ログイン時に復活させない。
    // そのため active 状態に関係なく同じ sortOrder が既存なら seed 済みとして扱う。
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) =>
        q.eq("groupId", groupId).eq("sortOrder", category.sortOrder),
      )
      .unique();

    if (existing !== null) {
      if (shouldRefreshLegacyDefaultCategoryColor(existing, category)) {
        await ctx.db.patch(existing._id, {
          color: category.color,
          updatedAt: now,
        });
      }
      skipped++;
      continue;
    }

    await ctx.db.insert("categories", {
      groupId,
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

function normalizeCategoryName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("Category name is required");
  }
  if (trimmed.length > 40) {
    throw new ConvexError("Category name must be 40 characters or fewer");
  }
  return trimmed;
}

function normalizeCategoryColor(color: string) {
  const trimmed = color.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    throw new ConvexError("Category color must be a hex color");
  }
  return trimmed.toUpperCase();
}

async function getOwnedCategory(
  ctx: Pick<MutationCtx, "auth" | "db">,
  categoryId: Id<"categories">,
) {
  const { groupId } = await requireGroupMembership(ctx);
  const category = await ctx.db.get(categoryId);

  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }

  return { category, groupId };
}

type CreateCategoryArgs = {
  name: string;
  color: string;
};

/** createCategory mutation の handler ロジック（テスト用に export） */
export async function createCategoryHandler(ctx: MutationCtx, args: CreateCategoryArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const name = normalizeCategoryName(args.name);
  const color = normalizeCategoryColor(args.color);
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
    .take(MAX_CATEGORIES_PER_GROUP);

  if (existing.length >= MAX_CATEGORIES_PER_GROUP) {
    throw new ConvexError("Category limit reached");
  }

  const sortOrder = existing.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;
  const now = Date.now();

  const categoryId = await ctx.db.insert("categories", {
    groupId,
    name,
    color,
    isActive: true,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(categoryId);
}

type UpdateCategoryArgs = {
  categoryId: Id<"categories">;
  name: string;
  color: string;
};

/** updateCategory mutation の handler ロジック（テスト用に export） */
export async function updateCategoryHandler(ctx: MutationCtx, args: UpdateCategoryArgs) {
  await getOwnedCategory(ctx, args.categoryId);
  const name = normalizeCategoryName(args.name);
  const color = normalizeCategoryColor(args.color);

  await ctx.db.patch(args.categoryId, {
    name,
    color,
    updatedAt: Date.now(),
  });

  return await ctx.db.get(args.categoryId);
}

type DeactivateCategoryArgs = {
  categoryId: Id<"categories">;
};

/** deactivateCategory mutation の handler ロジック（テスト用に export） */
export async function deactivateCategoryHandler(ctx: MutationCtx, args: DeactivateCategoryArgs) {
  await getOwnedCategory(ctx, args.categoryId);

  await ctx.db.patch(args.categoryId, {
    isActive: false,
    updatedAt: Date.now(),
  });

  return await ctx.db.get(args.categoryId);
}

/**
 * 初回ログイン時にデフォルトカテゴリを seed する mutation。
 * groupId はサーバー側でグループメンバーシップから解決するため、
 * クライアントから groupId を渡さない。
 */
export const seedDefaultCategories = mutation({
  args: {},
  handler: seedDefaultCategoriesHandler,
});

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

export const createCategory = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  handler: createCategoryHandler,
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    color: v.string(),
  },
  handler: updateCategoryHandler,
});

export const deactivateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: deactivateCategoryHandler,
});

export const deleteE2eCategoriesByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, { groupId }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
      .take(MAX_CATEGORIES_PER_GROUP);

    const targets = categories.filter((category) =>
      category.name.startsWith(E2E_CATEGORY_NAME_PREFIX),
    );

    await Promise.all(targets.map((category) => ctx.db.delete(category._id)));

    return { deletedCount: targets.length };
  },
});

export const ensureE2eCategoryByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { groupId, name, color }) => {
    if (!name.startsWith(E2E_CATEGORY_NAME_PREFIX)) {
      throw new ConvexError("E2E category name must start with the E2E prefix");
    }

    const normalizedName = normalizeCategoryName(name);
    const normalizedColor = normalizeCategoryColor(color);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
      .take(MAX_CATEGORIES_PER_GROUP);

    const matched = existing.find((category) => category.name === normalizedName);
    const now = Date.now();

    if (matched) {
      await ctx.db.patch(matched._id, {
        color: normalizedColor,
        isActive: true,
        updatedAt: now,
      });
      return matched._id;
    }

    if (existing.length >= MAX_CATEGORIES_PER_GROUP) {
      throw new ConvexError("Category limit reached");
    }

    const sortOrder = existing.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;
    return await ctx.db.insert("categories", {
      groupId,
      name: normalizedName,
      color: normalizedColor,
      isActive: true,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});

import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";

export const DEFAULT_CATEGORIES = [
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

export const MAX_CATEGORIES_PER_GROUP = 100;
export const E2E_CATEGORY_NAME_PREFIX = "E2Eカテゴリ-";

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

export function normalizeCategoryName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("Category name is required");
  }
  if (trimmed.length > 40) {
    throw new ConvexError("Category name must be 40 characters or fewer");
  }
  return trimmed;
}

export function normalizeCategoryColor(color: string) {
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

import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";
import {
  DEFAULT_CATEGORIES,
  MAX_CATEGORIES_PER_GROUP,
  shouldRefreshLegacyDefaultCategoryColor,
} from "../../lib/domain/categories/defaults";
import {
  normalizeCategoryColor,
  normalizeCategoryDescription,
  normalizeCategoryName,
} from "./normalize";

export { MAX_CATEGORY_DESCRIPTION_LENGTH, MAX_CATEGORY_NAME_LENGTH } from "./normalize";
export { DEFAULT_CATEGORIES, MAX_CATEGORIES_PER_GROUP };
export { shouldRefreshLegacyDefaultCategoryColor } from "../../lib/domain/categories/defaults";

export const E2E_CATEGORY_NAME_PREFIX = "E2Eカテゴリ-";

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
      const patch: { color?: string; description?: string; updatedAt: number } = {
        updatedAt: now,
      };
      if (shouldRefreshLegacyDefaultCategoryColor(existing, category)) {
        patch.color = category.color;
      }
      if (existing.name === category.name && existing.description === undefined) {
        patch.description = category.description;
      }
      if (Object.keys(patch).length > 1) {
        await ctx.db.patch(existing._id, {
          ...patch,
        });
      }
      skipped++;
      continue;
    }

    await ctx.db.insert("categories", {
      groupId,
      name: category.name,
      description: category.description,
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
  description?: string;
};

/** createCategory mutation の handler ロジック（テスト用に export） */
export async function createCategoryHandler(ctx: MutationCtx, args: CreateCategoryArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const name = normalizeCategoryName(args.name);
  const color = normalizeCategoryColor(args.color);
  const description = normalizeCategoryDescription(args.description);
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
    ...(description === undefined ? {} : { description }),
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
  description?: string;
};

/** updateCategory mutation の handler ロジック（テスト用に export） */
export async function updateCategoryHandler(ctx: MutationCtx, args: UpdateCategoryArgs) {
  await getOwnedCategory(ctx, args.categoryId);
  const name = normalizeCategoryName(args.name);
  const color = normalizeCategoryColor(args.color);
  const description = normalizeCategoryDescription(args.description);

  await ctx.db.patch(args.categoryId, {
    name,
    color,
    ...(description === undefined ? {} : { description }),
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
    description: v.optional(v.string()),
  },
  handler: createCategoryHandler,
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  },
  handler: updateCategoryHandler,
});

export const deactivateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: deactivateCategoryHandler,
});

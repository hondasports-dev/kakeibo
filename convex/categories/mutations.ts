import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";
import { MAX_CATEGORY_DESCRIPTION_LENGTH } from "../../lib/categoryDescription";

export { MAX_CATEGORY_DESCRIPTION_LENGTH } from "../../lib/categoryDescription";

export const DEFAULT_CATEGORIES = [
  {
    name: "食費",
    description: "スーパーや小売店で購入する食品、飲料、菓子など",
    color: "#8B5E3C",
    sortOrder: 1,
  },
  {
    name: "日用品",
    description: "洗剤、化粧品、歯科用品、衛生用品、レジ袋など",
    color: "#A6B28B",
    sortOrder: 2,
  },
  {
    name: "外食",
    description: "飲食店、テイクアウト、デリバリーなどの飲食費",
    color: "#F4A27A",
    sortOrder: 3,
  },
  {
    name: "交通",
    description: "電車、バス、タクシー、ガソリン、高速道路、駐車場など",
    color: "#AAB7C4",
    sortOrder: 4,
  },
  {
    name: "医療",
    description: "医薬品、診察、治療費など。歯科用品は日用品に分類する",
    color: "#C9734B",
    sortOrder: 5,
  },
  {
    name: "娯楽",
    description: "ゲーム、映画、レジャー、書籍、趣味など",
    color: "#6F7F55",
    sortOrder: 6,
  },
  {
    name: "衣服",
    description: "衣類、靴、バッグ、服飾品など",
    color: "#D8B28F",
    sortOrder: 7,
  },
  {
    name: "その他",
    description: "税金、公共料金、たばこ、他カテゴリーに該当しないもの",
    color: "#765F4F",
    sortOrder: 8,
  },
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

export function normalizeCategoryDescription(description?: string) {
  if (description === undefined) return undefined;
  if (description.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
    throw new ConvexError(
      `Category description must be ${MAX_CATEGORY_DESCRIPTION_LENGTH} characters or fewer`,
    );
  }
  return description;
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

import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  E2E_CATEGORY_NAME_PREFIX,
  MAX_CATEGORIES_PER_GROUP,
  normalizeCategoryColor,
  normalizeCategoryName,
} from "./mutations";

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

import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";

export async function assertExpenseCategoryBelongsToGroup(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories">,
  groupId: Id<"groups">,
  options?: {
    inactiveErrorMessage?: string;
    allowInactiveWhenUnchangedFrom?: Id<"categories">;
  },
) {
  const category = await ctx.db.get(categoryId);
  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
  if (!category.isActive) {
    if (options?.allowInactiveWhenUnchangedFrom === categoryId) {
      return category;
    }
    throw new ConvexError(
      options?.inactiveErrorMessage ?? "Inactive category cannot be used for new expense entries",
    );
  }
  return category;
}

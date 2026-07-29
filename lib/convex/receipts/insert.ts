import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { calculateWeekStartDate } from "../../../convex/lib/weekDates";
import { getWeeklyStartDayForUser } from "../../../convex/users/weeklySettings";

export type CreateReceiptArgs =
  | {
      type?: "expense";
      date: string;
      shopName: string;
      amountYen: number;
      categoryId: Id<"categories">;
      memo?: string;
    }
  | {
      type: "income";
      date: string;
      bankName: string;
      amountYen: number;
      categoryId: Id<"categories">;
      memo?: string;
    };

export async function insertReceiptForGroup(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  args: CreateReceiptArgs,
  weekStartDay = 1,
) {
  if (args.type !== "income" && !args.shopName) {
    throw new ConvexError("shopName is required for expense receipts");
  }
  if (args.type === "income" && !args.bankName) {
    throw new ConvexError("bankName is required for income receipts");
  }

  const category = await ctx.db.get(args.categoryId);
  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
  if (!category.isActive) {
    throw new ConvexError("Inactive category cannot be used for new receipts");
  }

  const now = Date.now();
  const weekStartDate = calculateWeekStartDate(args.date, weekStartDay);

  return await ctx.db.insert("receipts", {
    groupId,
    date: args.date,
    type: args.type,
    shopName: args.type === "income" ? undefined : args.shopName,
    bankName: args.type === "income" ? args.bankName : undefined,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    memo: args.memo,
    weekStartDate,
    createdAt: now,
    updatedAt: now,
  });
}

/** createReceipt mutation の handler ロジック（テスト用に export） */
export async function createReceiptHandler(ctx: MutationCtx, args: CreateReceiptArgs) {
  const { groupId, userId } = await requireGroupMembership(ctx);
  const weekStartDay = await getWeeklyStartDayForUser(ctx, userId);
  const receiptId = await insertReceiptForGroup(ctx, groupId, args, weekStartDay);

  const receipt = await ctx.db.get(receiptId);
  if (receipt === null) {
    throw new ConvexError("Failed to retrieve created receipt");
  }
  return receipt;
}

import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { calculateWeekStartDate } from "../../../convex/lib/weekDates";
import { getWeeklyStartDayForUser } from "../../../convex/users/weeklySettings";
import { isValidIsoDateString } from "../../../lib/domain/week/weekDates";
import {
  validateExpenseAmount,
  validateExpenseMemo,
  validateExpenseTitle,
} from "../../../lib/domain/expenseEntries/expenseEntryItem";

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
  if (!isValidIsoDateString(args.date)) {
    throw new ConvexError("Date must be a valid YYYY-MM-DD value");
  }
  if (!validateExpenseAmount(args.amountYen).success) {
    throw new ConvexError("Amount must be a positive integer");
  }
  const memoResult = validateExpenseMemo(args.memo);
  if (!memoResult.success) {
    throw new ConvexError("Memo must be 500 characters or less");
  }

  let shopName: string | undefined;
  if (args.type !== "income") {
    const result = validateExpenseTitle(args.shopName ?? "");
    if (!result.success) {
      if (result.error === "empty") {
        throw new ConvexError("shopName is required for expense receipts");
      }
      throw new ConvexError("shopName must be 100 characters or fewer");
    }
    shopName = result.title;
  }

  let bankName: string | undefined;
  if (args.type === "income") {
    const result = validateExpenseTitle(args.bankName ?? "");
    if (!result.success) {
      if (result.error === "empty") {
        throw new ConvexError("bankName is required for income receipts");
      }
      throw new ConvexError("bankName must be 100 characters or fewer");
    }
    bankName = result.title;
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
    shopName,
    bankName,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    memo: memoResult.memo,
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

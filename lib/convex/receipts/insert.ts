import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { calculateWeekStartDate } from "../../../convex/lib/weekDates";
import { getWeeklyStartDayForUser } from "../../../convex/users/weeklySettings";
import {
  normalizeCreateReceiptArgs,
  type CreateReceiptInput,
  type NormalizedCreateReceipt,
} from "../../../lib/domain/receipt/normalize";

export type CreateReceiptArgs = CreateReceiptInput<Id<"categories">>;

export async function insertReceiptForGroup(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  args: CreateReceiptArgs,
  weekStartDay = 1,
) {
  let normalized: NormalizedCreateReceipt<Id<"categories">>;
  try {
    normalized = normalizeCreateReceiptArgs(args);
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid receipt");
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
  const weekStartDate = calculateWeekStartDate(normalized.date, weekStartDay);

  return await ctx.db.insert("receipts", {
    groupId,
    date: normalized.date,
    type: normalized.type,
    shopName: normalized.shopName,
    bankName: normalized.bankName,
    amountYen: normalized.amountYen,
    categoryId: args.categoryId,
    memo: normalized.memo,
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

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAuthenticatedUserId } from "./users";
import type { Id } from "./_generated/dataModel";
import { calculateWeekStartDate } from "./utils";

// ---------------------------------------------------------------------------
// createReceipt
// ---------------------------------------------------------------------------

type CreateReceiptArgs = {
  date: string;
  shopName: string;
  amountYen: number;
  categoryId: Id<"categories">;
  memo?: string;
};

/** createReceipt mutation の handler ロジック（テスト用に export） */
export async function createReceiptHandler(
  ctx: MutationCtx,
  args: CreateReceiptArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);

  // categoryId の所有権チェック
  const category = await ctx.db.get(args.categoryId);
  if (category === null) {
    throw new ConvexError("Category not found");
  }
  if (category.userId !== userId) {
    throw new ConvexError("Category does not belong to the current user");
  }

  const now = Date.now();
  const weekStartDate = calculateWeekStartDate(args.date);

  const receiptId = await ctx.db.insert("receipts", {
    userId,
    date: args.date,
    shopName: args.shopName,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    memo: args.memo,
    weekStartDate,
    createdAt: now,
    updatedAt: now,
  });

  const receipt = await ctx.db.get(receiptId);
  if (receipt === null) {
    throw new ConvexError("Failed to retrieve created receipt");
  }
  return receipt;
}

export const createReceipt = mutation({
  args: {
    date: v.string(),
    shopName: v.string(),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    memo: v.optional(v.string()),
  },
  handler: createReceiptHandler,
});

// ---------------------------------------------------------------------------
// getReceiptsByWeek
// ---------------------------------------------------------------------------

type GetReceiptsByWeekArgs = {
  weekStartDate: string;
};

/** getReceiptsByWeek query の handler ロジック（テスト用に export） */
export async function getReceiptsByWeekHandler(
  ctx: QueryCtx,
  args: GetReceiptsByWeekArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_week_start_date", (q) =>
      q.eq("userId", userId).eq("weekStartDate", args.weekStartDate),
    )
    .take(200);
}

export const getReceiptsByWeek = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getReceiptsByWeekHandler,
});

// ---------------------------------------------------------------------------
// getReceiptsByDate
// ---------------------------------------------------------------------------

type GetReceiptsByDateArgs = {
  date: string;
};

/** getReceiptsByDate query の handler ロジック（テスト用に export） */
export async function getReceiptsByDateHandler(
  ctx: QueryCtx,
  args: GetReceiptsByDateArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_user_id_and_date", (q) =>
      q.eq("userId", userId).eq("date", args.date),
    )
    .take(50);
}

export const getReceiptsByDate = query({
  args: {
    date: v.string(),
  },
  handler: getReceiptsByDateHandler,
});

// ---------------------------------------------------------------------------
// updateReceipt
// ---------------------------------------------------------------------------

type UpdateReceiptArgs = {
  receiptId: Id<"receipts">;
  date?: string;
  shopName?: string;
  amountYen?: number;
  categoryId?: Id<"categories">;
  memo?: string;
};

/** updateReceipt mutation の handler ロジック（テスト用に export） */
export async function updateReceiptHandler(
  ctx: MutationCtx,
  args: UpdateReceiptArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.userId !== userId) {
    throw new ConvexError("Receipt does not belong to the current user");
  }

  // categoryId が指定された場合は所有権チェック
  if (args.categoryId !== undefined) {
    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.userId !== userId) {
      throw new ConvexError("Category does not belong to the current user");
    }
  }

  const now = Date.now();
  const patch: Partial<{
    date: string;
    shopName: string;
    amountYen: number;
    categoryId: Id<"categories">;
    memo: string | undefined;
    weekStartDate: string;
    updatedAt: number;
  }> = { updatedAt: now };

  if (args.date !== undefined) {
    patch.date = args.date;
    patch.weekStartDate = calculateWeekStartDate(args.date);
  }
  if (args.shopName !== undefined) {
    patch.shopName = args.shopName;
  }
  if (args.amountYen !== undefined) {
    patch.amountYen = args.amountYen;
  }
  if (args.categoryId !== undefined) {
    patch.categoryId = args.categoryId;
  }
  if (args.memo !== undefined) {
    patch.memo = args.memo;
  }

  await ctx.db.patch(args.receiptId, patch);

  const updated = await ctx.db.get(args.receiptId);
  if (updated === null) {
    throw new ConvexError("Failed to retrieve updated receipt");
  }
  return updated;
}

export const updateReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
    date: v.optional(v.string()),
    shopName: v.optional(v.string()),
    amountYen: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    memo: v.optional(v.string()),
  },
  handler: updateReceiptHandler,
});

// ---------------------------------------------------------------------------
// deleteReceipt
// ---------------------------------------------------------------------------

type DeleteReceiptArgs = {
  receiptId: Id<"receipts">;
};

/** deleteReceipt mutation の handler ロジック（テスト用に export） */
export async function deleteReceiptHandler(
  ctx: MutationCtx,
  args: DeleteReceiptArgs,
) {
  const userId = await requireAuthenticatedUserId(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.userId !== userId) {
    throw new ConvexError("Receipt does not belong to the current user");
  }

  await ctx.db.delete(args.receiptId);
}

export const deleteReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: deleteReceiptHandler,
});

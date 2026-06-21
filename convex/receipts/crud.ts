import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";
import { calculateWeekStartDate } from "../utils";

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
  const weekStartDate = calculateWeekStartDate(args.date);

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
  const { groupId } = await requireGroupMembership(ctx);
  const receiptId = await insertReceiptForGroup(ctx, groupId, args);

  const receipt = await ctx.db.get(receiptId);
  if (receipt === null) {
    throw new ConvexError("Failed to retrieve created receipt");
  }
  return receipt;
}

type GetReceiptsByWeekArgs = {
  weekStartDate: string;
};

/** getReceiptsByWeek query の handler ロジック（テスト用に export） */
export async function getReceiptsByWeekHandler(ctx: QueryCtx, args: GetReceiptsByWeekArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) =>
      q.eq("groupId", groupId).eq("weekStartDate", args.weekStartDate),
    )
    .order("desc")
    .take(200);
}

type GetReceiptsByDateArgs = {
  date: string;
};

/** getReceiptsByDate query の handler ロジック（テスト用に export） */
export async function getReceiptsByDateHandler(ctx: QueryCtx, args: GetReceiptsByDateArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  return await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId).eq("date", args.date))
    .take(50);
}

type UpdateReceiptArgs = {
  receiptId: Id<"receipts">;
  date?: string;
  shopName?: string;
  amountYen?: number;
  categoryId?: Id<"categories">;
  memo?: string;
};

/** updateReceipt mutation の handler ロジック（テスト用に export） */
export async function updateReceiptHandler(ctx: MutationCtx, args: UpdateReceiptArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.groupId !== groupId) {
    throw new ConvexError("Receipt does not belong to the current group");
  }

  // categoryId が指定された場合は所有権チェック
  if (args.categoryId !== undefined) {
    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError("Category not found");
    }
    if (category.groupId !== groupId) {
      throw new ConvexError("Category does not belong to the current group");
    }
    if (!category.isActive && (args.categoryId as string) !== (receipt.categoryId as string)) {
      throw new ConvexError("Inactive category cannot be used for new receipts");
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

type DeleteReceiptArgs = {
  receiptId: Id<"receipts">;
};

/** deleteReceipt mutation の handler ロジック（テスト用に export） */
export async function deleteReceiptHandler(ctx: MutationCtx, args: DeleteReceiptArgs) {
  const { groupId } = await requireGroupMembership(ctx);

  // receipt の所有権チェック
  const receipt = await ctx.db.get(args.receiptId);
  if (receipt === null) {
    throw new ConvexError("Receipt not found");
  }
  if (receipt.groupId !== groupId) {
    throw new ConvexError("Receipt does not belong to the current group");
  }

  await ctx.db.delete(args.receiptId);
}

/**
 * 指定グループのレシートを全件削除する（E2E テストデータクリーンアップ専用）。
 */
export async function deleteReceiptsByUserHandler(
  ctx: MutationCtx,
  args: { groupId: Id<"groups"> },
) {
  const receipts = await ctx.db
    .query("receipts")
    .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", args.groupId))
    .collect();

  await Promise.all(receipts.map((r) => ctx.db.delete(r._id)));

  return { deletedCount: receipts.length };
}

export const createReceipt = mutation({
  args: {
    date: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    shopName: v.optional(v.string()),
    bankName: v.optional(v.string()),
    amountYen: v.number(),
    categoryId: v.id("categories"),
    memo: v.optional(v.string()),
  },
  handler: createReceiptHandler,
});

export const getReceiptsByWeek = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: getReceiptsByWeekHandler,
});

export const getReceiptsByDate = query({
  args: {
    date: v.string(),
  },
  handler: getReceiptsByDateHandler,
});

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

export const deleteReceipt = mutation({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: deleteReceiptHandler,
});

/**
 * 指定グループのレシートを全件削除する。
 *
 * この mutation は internalMutation として定義されており、外部クライアントから
 * 直接呼び出せない。E2E テスト用の HTTP エンドポイント（convex/http.ts）経由でのみ呼び出す。
 */
export const deleteReceiptsByUser = internalMutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: deleteReceiptsByUserHandler,
});

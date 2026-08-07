import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { assertExpenseCategoryBelongsToGroup } from "./expenseEntryValidation";
import {
  validateExpenseAmount,
  validateExpenseTitle,
} from "../../../lib/domain/expenseEntries/expenseEntryItem";

type DraftItemArg = {
  itemName?: string;
  amountYen: number;
  categoryId?: Id<"categories">;
};

export type CreateExpenseEntriesFromDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
  items: DraftItemArg[];
};

export async function createExpenseEntriesFromDraftHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateExpenseEntriesFromDraftArgs,
): Promise<Id<"expenseEntries">[]> {
  const { groupId } = await requireGroupMembership(ctx);

  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("Draft not found");
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("Draft does not belong to the current group");
  }
  if (draft.status !== "ready") {
    throw new ConvexError("Only ready drafts can create expense entries");
  }
  if (!draft.date) {
    throw new ConvexError("Draft date is required");
  }

  const now = Date.now();
  const createdIds: Id<"expenseEntries">[] = [];

  for (const item of args.items) {
    if (!validateExpenseAmount(item.amountYen).success) {
      throw new ConvexError("Amount must be a positive integer");
    }
    const categoryId = item.categoryId ?? draft.categoryId;
    if (categoryId === undefined) {
      throw new ConvexError("Category ID is required");
    }

    await assertExpenseCategoryBelongsToGroup(ctx, categoryId, groupId);

    const titleResult = validateExpenseTitle(item.itemName ?? "不明");
    if (!titleResult.success) {
      throw new ConvexError("Title is required");
    }

    const entryId = await ctx.db.insert("expenseEntries", {
      groupId,
      sourceDocumentId: undefined,
      aiExpenseDraftId: args.draftId,
      date: draft.date,
      amount: item.amountYen,
      categoryId,
      title: titleResult.title,
      entryType: "expense",
      source: "ai_suggested",
      createdAt: now,
      updatedAt: now,
    });
    createdIds.push(entryId);
  }

  return createdIds;
}

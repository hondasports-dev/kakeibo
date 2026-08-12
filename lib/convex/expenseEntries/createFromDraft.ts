import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { assertExpenseCategoryBelongsToGroup } from "./expenseEntryValidation";
import {
  buildDraftExpenseEntry,
  getDraftExpenseEntryErrorMessage,
  type DraftExpenseEntryInput,
} from "../../../lib/domain/expenseEntries/createFromDraft";

type DraftItemArg = DraftExpenseEntryInput<Id<"categories">>;

export type CreateExpenseEntriesFromDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
  items: DraftItemArg[];
};

export async function createExpenseEntriesFromDraftHandler(
  ctx: Pick<MutationCtx, "auth" | "db">,
  args: CreateExpenseEntriesFromDraftArgs,
): Promise<Id<"expenseEntries">[]> {
  const { groupId, userId } = await requireGroupMembership(ctx);

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
    const buildResult = buildDraftExpenseEntry(item, draft.categoryId);
    if (!buildResult.success) {
      throw new ConvexError(getDraftExpenseEntryErrorMessage(buildResult.error));
    }

    await assertExpenseCategoryBelongsToGroup(ctx, buildResult.entry.categoryId, groupId);

    const entryId = await ctx.db.insert("expenseEntries", {
      groupId,
      createdByUserId: userId,
      sourceDocumentId: undefined,
      aiExpenseDraftId: args.draftId,
      date: draft.date,
      amount: buildResult.entry.amount,
      categoryId: buildResult.entry.categoryId,
      title: buildResult.entry.title,
      entryType: "expense",
      source: "ai_suggested",
      createdAt: now,
      updatedAt: now,
    });
    createdIds.push(entryId);
  }

  return createdIds;
}

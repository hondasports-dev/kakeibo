import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { createExpenseEntriesFromDraftHandler } from "../expenseEntries/createFromDraft";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { aggregateDraftItemsByCategory } from "./reviewValidation";

type RegisterReadyDraftsArgs = {
  draftIds: Id<"aiExpenseDrafts">[];
};

function dedupeDraftIds(draftIds: Id<"aiExpenseDrafts">[]) {
  return [...new Set(draftIds)];
}

function assertReadyDraftCanBeRegistered(draft: Doc<"aiExpenseDrafts">) {
  if (draft.status !== "ready") {
    throw new ConvexError("Only ready drafts can be registered");
  }
  if (!draft.date) {
    throw new ConvexError("Draft date is required to register");
  }
  if (draft.amountYen === undefined || draft.amountYen <= 0) {
    throw new ConvexError("Draft amount is required to register");
  }
  if (!draft.categoryId) {
    throw new ConvexError("Draft category is required to register");
  }
}

export async function registerReadyDraftsAsExpenseEntriesHandler(
  ctx: MutationCtx,
  args: RegisterReadyDraftsArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  const uniqueDraftIds = dedupeDraftIds(args.draftIds);
  if (uniqueDraftIds.length === 0) {
    return {
      registeredDraftIds: [] as Id<"aiExpenseDrafts">[],
      createdExpenseEntryIds: [] as Id<"expenseEntries">[],
      alreadyRegisteredDraftIds: [] as Id<"aiExpenseDrafts">[],
    };
  }

  const drafts = await Promise.all(
    uniqueDraftIds.map(async (draftId) => {
      const draft = await ctx.db.get(draftId);
      if (draft === null) {
        throw new ConvexError("AI expense draft not found");
      }
      if (draft.groupId !== groupId) {
        throw new ConvexError("AI expense draft does not belong to the current group");
      }
      return draft;
    }),
  );

  const draftsToRegister: Doc<"aiExpenseDrafts">[] = [];
  const alreadyRegisteredDraftIds: Id<"aiExpenseDrafts">[] = [];

  for (const draft of drafts) {
    if (draft.status === "registered") {
      alreadyRegisteredDraftIds.push(draft._id);
      continue;
    }
    assertReadyDraftCanBeRegistered(draft);
    draftsToRegister.push(draft);
  }

  const createdExpenseEntryIds: Id<"expenseEntries">[] = [];

  for (const draft of draftsToRegister) {
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", groupId).eq("draftId", draft._id),
      )
      .order("asc")
      .take(100);

    const itemsToRegister = aggregateDraftItemsByCategory(draft, items);

    const entryIds = await createExpenseEntriesFromDraftHandler(ctx, {
      draftId: draft._id,
      items: itemsToRegister,
    });
    createdExpenseEntryIds.push(...entryIds);
  }

  const now = Date.now();
  await Promise.all(
    draftsToRegister.map((draft) =>
      ctx.db.patch(draft._id, {
        status: "registered",
        updatedAt: now,
      }),
    ),
  );

  return {
    registeredDraftIds: draftsToRegister.map((draft) => draft._id),
    createdExpenseEntryIds,
    alreadyRegisteredDraftIds,
  };
}

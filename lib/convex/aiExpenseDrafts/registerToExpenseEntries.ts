import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { createExpenseEntriesFromDraftHandler } from "../expenseEntries/createFromDraft";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { aggregateDraftItemsByCategory } from "./reviewValidation";
import {
  dedupeDraftIds,
  isAlreadyRegistered,
  validateReadyDraftForRegistration,
} from "../../domain/aiExpenseDrafts/registration";

type RegisterReadyDraftsArgs = {
  draftIds: Id<"aiExpenseDrafts">[];
};

function assertReadyDraftCanBeRegistered(draft: Doc<"aiExpenseDrafts">) {
  const result = validateReadyDraftForRegistration(draft);
  if (!result.success) {
    const messages: Record<typeof result.error, string> = {
      not_ready: "Only ready drafts can be registered",
      missing_date: "Draft date is required to register",
      missing_amount: "Draft amount is required to register",
      missing_category: "Draft category is required to register",
    };
    throw new ConvexError(messages[result.error]);
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
    if (isAlreadyRegistered(draft)) {
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

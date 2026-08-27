import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { requireGroupMembership } from "../../../convex/groups/membership";
import {
  buildDraftRegistrationItems,
  reconcileDraftExpenseEntries,
  resolveRegistrationMode,
} from "./reconcileExpenseEntries";
import {
  dedupeDraftIds,
  getReadyDraftRegistrationErrorMessage,
  isAlreadyRegistered,
  validateReadyDraftForRegistration,
} from "../../domain/aiExpenseDrafts/registration";

type RegisterReadyDraftsArgs = {
  draftIds: Id<"aiExpenseDrafts">[];
};

function assertReadyDraftCanBeRegistered(draft: Doc<"aiExpenseDrafts">) {
  const result = validateReadyDraftForRegistration(draft);
  if (!result.success) {
    throw new ConvexError(getReadyDraftRegistrationErrorMessage(result.error));
  }
}

export async function registerReadyDraftsAsExpenseEntriesHandler(
  ctx: MutationCtx,
  args: RegisterReadyDraftsArgs,
) {
  const { groupId, userId } = await requireGroupMembership(ctx);
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
  const registeredCategoryIds = new Map<Id<"aiExpenseDrafts">, Id<"categories">[]>();

  for (const draft of draftsToRegister) {
    const items = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", groupId).eq("draftId", draft._id),
      )
      .order("asc")
      .take(100);

    const itemsToRegister = buildDraftRegistrationItems(draft, items);
    registeredCategoryIds.set(draft._id, [
      ...new Set(itemsToRegister.map((item) => item.categoryId)),
    ]);

    const entryIds = await reconcileDraftExpenseEntries(ctx, {
      draft,
      groupId,
      userId,
      items: itemsToRegister,
      now: Date.now(),
    });
    createdExpenseEntryIds.push(...entryIds);
  }

  const now = Date.now();
  await Promise.all(
    draftsToRegister.map((draft) =>
      ctx.db.patch(draft._id, {
        status: "registered",
        derivedRegistration: {
          source: "derived",
          destination: "expense_entries",
          registrationMode: resolveRegistrationMode(draft),
          ...(resolveRegistrationMode(draft) === "totalOnly"
            ? { taxRatePercent: null, taxableAmountYen: null, taxYen: null }
            : {}),
          amountYen: draft.amountYen!,
          date: draft.date!,
          categoryIds: registeredCategoryIds.get(draft._id) ?? [],
          registeredAt: now,
        },
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

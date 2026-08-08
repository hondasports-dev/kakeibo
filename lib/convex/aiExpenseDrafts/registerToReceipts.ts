import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { insertReceiptForGroup } from "../../../convex/receipts/crud";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { resolveReceiptShopNameFromDraft } from "../../domain/aiExpenseDrafts/shopName";
import {
  dedupeDraftIds,
  getReadyDraftRegistrationErrorMessage,
  isAlreadyRegisteredAsReceipt,
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

export async function registerReadyDraftsHandler(ctx: MutationCtx, args: RegisterReadyDraftsArgs) {
  const { groupId } = await requireGroupMembership(ctx);
  const uniqueDraftIds = dedupeDraftIds(args.draftIds);
  if (uniqueDraftIds.length === 0) {
    return {
      registeredDraftIds: [] as Id<"aiExpenseDrafts">[],
      registeredReceiptIds: [] as Id<"receipts">[],
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
    if (isAlreadyRegisteredAsReceipt(draft)) {
      alreadyRegisteredDraftIds.push(draft._id);
      continue;
    }
    assertReadyDraftCanBeRegistered(draft);
    draftsToRegister.push(draft);
  }

  const registeredReceiptIds: Id<"receipts">[] = [];

  for (const draft of draftsToRegister) {
    const receiptId = await insertReceiptForGroup(ctx, groupId, {
      type: "expense",
      date: draft.date!,
      shopName: resolveReceiptShopNameFromDraft(draft),
      amountYen: draft.amountYen!,
      categoryId: draft.categoryId!,
    });
    registeredReceiptIds.push(receiptId);
  }

  const now = Date.now();
  await Promise.all(
    draftsToRegister.map((draft, index) =>
      ctx.db.patch(draft._id, {
        status: "registered",
        registeredReceiptId: registeredReceiptIds[index],
        updatedAt: now,
      }),
    ),
  );

  return {
    registeredDraftIds: draftsToRegister.map((draft) => draft._id),
    registeredReceiptIds,
    alreadyRegisteredDraftIds,
  };
}

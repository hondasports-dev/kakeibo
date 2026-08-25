import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  persistDraftTaxInterpretation,
  type PersistDraftTaxInterpretationResult,
} from "./persistTaxInterpretation";
import type { AmountBasis } from "../../receiptTax/types";
import type { ReceiptItemTaxRatePercent } from "../receiptImageExtraction/types";
import { persistReceiptUserOverrideSnapshot } from "./receiptDataContract";

export type UpdateDraftItemTaxOverridesArgs = {
  draftId: Id<"aiExpenseDrafts">;
  itemId: Id<"aiExpenseDraftItems">;
  taxRatePercent?: ReceiptItemTaxRatePercent;
  amountBasis?: AmountBasis;
};

export type UpdateDraftItemTaxOverridesResult = PersistDraftTaxInterpretationResult;

export async function updateDraftItemTaxOverridesHandler(
  ctx: MutationCtx,
  args: UpdateDraftItemTaxOverridesArgs,
  groupId: Id<"groups">,
): Promise<UpdateDraftItemTaxOverridesResult> {
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft not found");
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  if (draft.status === "registered") {
    throw new ConvexError("Registered AI expense draft cannot be edited");
  }
  if (draft.status !== "needs_review" && draft.status !== "ready") {
    throw new ConvexError("Only needs_review or ready AI expense drafts can be edited");
  }
  if (draft.amountYen === undefined || !draft.taxSummaries || draft.taxSummaries.length === 0) {
    throw new ConvexError("Tax reinterpretation requires draft amount and tax summaries");
  }

  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .collect();

  const itemIndex = items.findIndex((item) => item._id === args.itemId);
  if (itemIndex < 0) {
    throw new ConvexError("AI expense draft item not found");
  }

  const result = await persistDraftTaxInterpretation(ctx, {
    draftId: args.draftId,
    groupId,
    override: {
      itemIndex,
      taxRatePercent: args.taxRatePercent,
      amountBasis: args.amountBasis,
    },
  });
  const updatedDraft = await persistReceiptUserOverrideSnapshot(ctx, {
    draftId: args.draftId,
    groupId,
    fields: ["items", "receiptTotalResolution"],
  });
  return { ...result, draft: updatedDraft };
}

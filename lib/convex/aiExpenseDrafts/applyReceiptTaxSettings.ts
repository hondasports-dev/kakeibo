import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  persistDraftTaxInterpretation,
  type PersistDraftTaxInterpretationResult,
} from "./persistTaxInterpretation";
import { resolveAmountBasisFromSummary } from "../../receiptTax/reinterpretDraftTax";
import type { AmountBasis } from "../../receiptTax/types";
import type { ReceiptItemTaxRatePercent } from "../receiptImageExtraction/types";

export type ApplyReceiptTaxSettingsArgs = {
  draftId: Id<"aiExpenseDrafts">;
  taxRatePercent?: ReceiptItemTaxRatePercent;
  amountBasis?: AmountBasis;
};

export type UpdateDraftItemTaxOverridesResult = PersistDraftTaxInterpretationResult;

export async function applyReceiptTaxSettingsHandler(
  ctx: MutationCtx,
  args: ApplyReceiptTaxSettingsArgs,
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
  if (draft.taxSummaries.length !== 1) {
    throw new ConvexError("Bulk tax settings require a single tax summary");
  }

  const summary = draft.taxSummaries[0];
  if (summary.taxMode === "unknown" || summary.taxMode === "mixed") {
    throw new ConvexError("Bulk tax settings require a definitive tax mode");
  }

  const taxRatePercent = args.taxRatePercent ?? summary.taxRatePercent;
  const amountBasis = args.amountBasis ?? resolveAmountBasisFromSummary(summary) ?? undefined;

  if (amountBasis === undefined) {
    throw new ConvexError("Could not derive amount basis from tax summary");
  }

  return await persistDraftTaxInterpretation(ctx, {
    draftId: args.draftId,
    groupId,
    bulkUnresolvedOverride: {
      taxRatePercent,
      amountBasis,
    },
  });
}

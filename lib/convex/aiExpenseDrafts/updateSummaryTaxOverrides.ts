import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  persistDraftTaxInterpretation,
  type PersistDraftTaxInterpretationResult,
} from "./persistTaxInterpretation";
import type { AmountBasis, TaxMode, TaxRatePercent } from "../../receiptTax/types";
import { buildDraftSummaryOverride } from "../../domain/receipt/tax/summaryOverrides";

export type UpdateSummaryTaxOverridesArgs = {
  draftId: Id<"aiExpenseDrafts">;
  summaryIndex: number;
  taxRatePercent?: TaxRatePercent;
  taxMode?: TaxMode;
  taxableAmountYen?: number;
  taxableAmountBasis?: AmountBasis;
  taxYen?: number;
  taxIncludedAmountYen?: number;
};

export type UpdateSummaryTaxOverridesResult = PersistDraftTaxInterpretationResult;

export async function updateSummaryTaxOverridesHandler(
  ctx: MutationCtx,
  args: UpdateSummaryTaxOverridesArgs,
  groupId: Id<"groups">,
): Promise<UpdateSummaryTaxOverridesResult> {
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
  if (
    !Number.isInteger(args.summaryIndex) ||
    args.summaryIndex < 0 ||
    args.summaryIndex >= draft.taxSummaries.length
  ) {
    throw new ConvexError("Tax summary index is out of range");
  }

  let summaryOverride;
  try {
    summaryOverride = buildDraftSummaryOverride({
      index: args.summaryIndex,
      taxRatePercent: args.taxRatePercent,
      taxMode: args.taxMode,
      taxableAmountYen: args.taxableAmountYen,
      taxableAmountBasis: args.taxableAmountBasis,
      taxYen: args.taxYen,
      taxIncludedAmountYen: args.taxIncludedAmountYen,
    });
  } catch (err) {
    throw new ConvexError(err instanceof Error ? err.message : "Invalid tax override");
  }

  return await persistDraftTaxInterpretation(ctx, {
    draftId: args.draftId,
    groupId,
    summaryOverride,
  });
}

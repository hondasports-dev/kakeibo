import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  persistDraftTaxInterpretation,
  type PersistDraftTaxInterpretationResult,
} from "./persistTaxInterpretation";
import type {
  AmountBasis,
  DraftSummaryOverride,
  TaxMode,
  TaxRatePercent,
} from "../../receiptTax/types";

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

function assertNonNegativeFinite(value: number | undefined, name: string) {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new ConvexError(`${name} must be a finite non-negative number`);
  }
}

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

  assertNonNegativeFinite(args.taxableAmountYen, "taxableAmountYen");
  assertNonNegativeFinite(args.taxYen, "taxYen");
  assertNonNegativeFinite(args.taxIncludedAmountYen, "taxIncludedAmountYen");

  const summary: DraftSummaryOverride["summary"] = {};
  if (args.taxRatePercent !== undefined) summary.taxRatePercent = args.taxRatePercent;
  if (args.taxMode !== undefined) summary.taxMode = args.taxMode;
  if (args.taxableAmountYen !== undefined) summary.taxableAmountYen = args.taxableAmountYen;
  if (args.taxableAmountBasis !== undefined) summary.taxableAmountBasis = args.taxableAmountBasis;
  if (args.taxYen !== undefined) summary.taxYen = args.taxYen;
  if (args.taxIncludedAmountYen !== undefined)
    summary.taxIncludedAmountYen = args.taxIncludedAmountYen;

  return await persistDraftTaxInterpretation(ctx, {
    draftId: args.draftId,
    groupId,
    summaryOverride: {
      index: args.summaryIndex,
      summary,
    },
  });
}

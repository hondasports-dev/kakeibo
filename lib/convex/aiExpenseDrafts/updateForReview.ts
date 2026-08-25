import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import { classifyAiExpenseDraft } from "../../../convex/aiExpenseDrafts/model";
import { requireGroupMembership } from "../../../convex/groups/membership";
import {
  assertActiveCategoryBelongsToGroup,
  assertPositiveCategoryTotals,
  assertReviewUpdateCanBecomeReady,
  replaceDraftItemsForReview,
  type UpdateForReviewArgs,
} from "./reviewValidation";
import { buildReviewConfidence } from "../../../lib/domain/aiExpenseDrafts/review";
import { trimOptional } from "../../../lib/domain/common/string";
import { persistDraftTaxInterpretation } from "./persistTaxInterpretation";
import { nonTaxReviewReasons } from "../../domain/aiExpenseDrafts/reviewReasons";
import { persistReceiptUserOverrideSnapshot } from "./receiptDataContract";
import { resolveReceiptTotal } from "../../domain/receipt/tax/resolveReceiptTotal";

const REVIEW_OVERRIDE_FIELDS = [
  "documentType",
  "shopName",
  "paymentPlace",
  "payeeName",
  "paymentPurpose",
  "date",
  "amountYen",
  "categoryId",
] as const;

export async function updateForReviewHandler(ctx: MutationCtx, args: UpdateForReviewArgs) {
  const { groupId } = await requireGroupMembership(ctx);
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

  await assertActiveCategoryBelongsToGroup(ctx, args.categoryId, groupId);
  assertReviewUpdateCanBecomeReady(args);

  const now = Date.now();
  if (args.items !== undefined) {
    assertPositiveCategoryTotals(args.items);
    await replaceDraftItemsForReview(ctx, args.draftId, groupId, args.items, now);
  }

  const reviewConfidence = buildReviewConfidence(draft.confidence, {
    shopName: args.shopName,
    paymentPlace: args.paymentPlace,
    payeeName: args.payeeName,
    paymentPurpose: args.paymentPurpose,
  });

  const classification = classifyAiExpenseDraft({
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName) ?? trimOptional(args.shopName),
    paymentPurpose: trimOptional(args.paymentPurpose) ?? trimOptional(args.shopName),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: reviewConfidence,
    warnings: [],
    multiCategoryConfirmed: true,
    items: args.items?.map((item) => ({
      itemName: item.itemName,
      amountYen: item.amountYen,
      categoryId: item.categoryId,
    })),
  });

  await ctx.db.patch(args.draftId, {
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName),
    paymentPurpose: trimOptional(args.paymentPurpose),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    confidence: reviewConfidence,
    updatedAt: now,
  });

  if (draft.taxSummaries && draft.taxSummaries.length > 0) {
    await persistDraftTaxInterpretation(ctx, {
      draftId: args.draftId,
      groupId,
      receiptTotalSource: "user_confirmed",
      preservedNonTaxReasons: nonTaxReviewReasons(classification.reviewReasons),
    });
    return await persistReceiptUserOverrideSnapshot(ctx, {
      draftId: args.draftId,
      groupId,
      fields: [
        ...REVIEW_OVERRIDE_FIELDS,
        "receiptTotalResolution",
        ...(args.items === undefined ? [] : ["items"]),
      ],
      updatedAt: now,
    });
  }

  await ctx.db.patch(args.draftId, {
    status: classification.status,
    receiptTotalResolution: resolveReceiptTotal({
      amountYen: args.amountYen,
      source: "user_confirmed",
      confidence: reviewConfidence.amountYen,
      supportingCandidates: draft.receiptTotalResolution?.candidates.filter(
        (candidate) => candidate.source !== "user_confirmed",
      ),
      taxSummaries: [],
    }),
    reviewReasons: classification.reviewReasons,
    updatedAt: now,
  });

  return await persistReceiptUserOverrideSnapshot(ctx, {
    draftId: args.draftId,
    groupId,
    fields: [
      ...REVIEW_OVERRIDE_FIELDS,
      "receiptTotalResolution",
      ...(args.items === undefined ? [] : ["items"]),
    ],
    updatedAt: now,
  });
}

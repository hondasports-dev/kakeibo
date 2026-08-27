import { ConvexError } from "convex/values";
import type { Doc } from "../../../convex/_generated/dataModel";
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
import {
  buildDraftRegistrationItems,
  reconcileDraftExpenseEntries,
  resolveRegistrationMode,
} from "./reconcileExpenseEntries";

const REVIEW_OVERRIDE_FIELDS = [
  "documentType",
  "shopName",
  "paymentPlace",
  "payeeName",
  "paymentPurpose",
  "date",
  "amountYen",
  "registrationMode",
  "categoryId",
] as const;

export async function updateForReviewHandler(ctx: MutationCtx, args: UpdateForReviewArgs) {
  const { groupId, userId } = await requireGroupMembership(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft not found");
  }
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  const wasRegistered = draft.status === "registered";
  if (
    wasRegistered &&
    (draft.registeredReceiptId !== undefined ||
      draft.derivedRegistration?.destination === "receipt")
  ) {
    throw new ConvexError("Legacy receipt registrations cannot be edited from the AI queue");
  }
  const hasTaxDecisionUpdate =
    args.priceTaxTreatment !== undefined || args.taxRateComposition !== undefined;
  const registrationMode =
    args.priceTaxTreatment === "unknown" || args.taxRateComposition === "unknown"
      ? "totalOnly"
      : (args.registrationMode ??
        (hasTaxDecisionUpdate ? "detailed" : (draft.registrationMode ?? "detailed")));
  if (!wasRegistered && draft.status !== "needs_review" && draft.status !== "ready") {
    throw new ConvexError("Only needs_review or ready AI expense drafts can be edited");
  }

  await assertActiveCategoryBelongsToGroup(ctx, args.categoryId, groupId);
  assertReviewUpdateCanBecomeReady(args);

  const now = Date.now();
  if (args.items !== undefined) {
    if (registrationMode === "detailed") {
      assertPositiveCategoryTotals(args.items);
    }
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
    items:
      registrationMode === "detailed"
        ? args.items?.map((item) => ({
            itemName: item.itemName,
            amountYen: item.amountYen,
            categoryId: item.categoryId,
          }))
        : undefined,
  });

  await ctx.db.patch(args.draftId, {
    documentType: args.documentType,
    shopName: trimOptional(args.shopName),
    paymentPlace: trimOptional(args.paymentPlace),
    payeeName: trimOptional(args.payeeName),
    paymentPurpose: trimOptional(args.paymentPurpose),
    date: trimOptional(args.date),
    amountYen: args.amountYen,
    registrationMode,
    categoryId: args.categoryId,
    confidence: reviewConfidence,
    updatedAt: now,
  });

  if (
    (draft.taxSummaries && draft.taxSummaries.length > 0) ||
    args.priceTaxTreatment !== undefined ||
    args.taxRateComposition !== undefined
  ) {
    await persistDraftTaxInterpretation(ctx, {
      draftId: args.draftId,
      groupId,
      receiptTotalSource: "user_confirmed",
      decisionOverride:
        args.priceTaxTreatment !== undefined || args.taxRateComposition !== undefined
          ? {
              priceTaxTreatment: args.priceTaxTreatment,
              taxRateComposition: args.taxRateComposition,
            }
          : undefined,
      preservedNonTaxReasons: nonTaxReviewReasons(classification.reviewReasons),
    });
    const updated = await persistReceiptUserOverrideSnapshot(ctx, {
      draftId: args.draftId,
      groupId,
      fields: [
        ...REVIEW_OVERRIDE_FIELDS,
        "receiptTotalResolution",
        ...(args.priceTaxTreatment !== undefined || args.taxRateComposition !== undefined
          ? ["receiptTaxDecision", "taxSummaries"]
          : []),
        ...(args.items === undefined ? [] : ["items"]),
      ],
      updatedAt: now,
    });
    return await reconcileRegisteredDraft(updated);
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

  const updated = await persistReceiptUserOverrideSnapshot(ctx, {
    draftId: args.draftId,
    groupId,
    fields: [
      ...REVIEW_OVERRIDE_FIELDS,
      "receiptTotalResolution",
      ...(args.items === undefined ? [] : ["items"]),
    ],
    updatedAt: now,
  });
  return await reconcileRegisteredDraft(updated);

  async function reconcileRegisteredDraft(updatedDraft: Doc<"aiExpenseDrafts">) {
    if (!wasRegistered) {
      return updatedDraft;
    }
    const updatedItems = await ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) =>
        q.eq("groupId", groupId).eq("draftId", args.draftId),
      )
      .order("asc")
      .take(100);
    const registrationItems = buildDraftRegistrationItems(updatedDraft, updatedItems);
    await reconcileDraftExpenseEntries(ctx, {
      draft: updatedDraft,
      groupId,
      userId,
      items: registrationItems,
      now,
    });
    await ctx.db.patch(args.draftId, {
      status: "registered",
      derivedRegistration: {
        source: "derived",
        destination: "expense_entries",
        registrationMode: resolveRegistrationMode(updatedDraft),
        ...(resolveRegistrationMode(updatedDraft) === "totalOnly"
          ? { taxRatePercent: null, taxableAmountYen: null, taxYen: null }
          : {}),
        amountYen: updatedDraft.amountYen!,
        date: updatedDraft.date!,
        categoryIds: [...new Set(registrationItems.map((item) => item.categoryId))],
        registeredAt: updatedDraft.derivedRegistration?.registeredAt ?? now,
      },
      updatedAt: now,
    });
    const reconciled = await ctx.db.get(args.draftId);
    if (reconciled === null) {
      throw new ConvexError("AI expense draft not found after registered update");
    }
    return reconciled;
  }
}

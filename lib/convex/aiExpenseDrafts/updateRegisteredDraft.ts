import { ConvexError } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { isValidIsoDateString } from "../../../convex/lib/weekDates";
import {
  validateExpenseAmount,
  validateExpenseTitle,
} from "../../domain/expenseEntries/expenseEntryItem";
import type { AiExpenseRegistrationMode } from "../../domain/aiExpenseDrafts/receiptDataContract";
import { resolveReceiptTotal } from "../../domain/receipt/tax/resolveReceiptTotal";
import {
  assertActiveCategoryBelongsToGroup,
  assertPositiveCategoryTotals,
  replaceDraftItemsForReview,
  type UpdateForReviewItem,
} from "./reviewValidation";
import { persistReceiptUserOverrideSnapshot } from "./receiptDataContract";
import {
  buildDraftRegistrationItems,
  reconcileDraftExpenseEntries,
} from "./reconcileExpenseEntries";

export type UpdateRegisteredDraftArgs = {
  draftId: Id<"aiExpenseDrafts">;
  date: string;
  amountYen: number;
  categoryId: Id<"categories">;
  shopName: string;
  registrationMode: AiExpenseRegistrationMode;
  items?: UpdateForReviewItem[];
};

export async function updateRegisteredDraftHandler(
  ctx: MutationCtx,
  args: UpdateRegisteredDraftArgs,
) {
  const { groupId, userId } = await requireGroupMembership(ctx);
  const draft = await ctx.db.get(args.draftId);
  if (draft === null) throw new ConvexError("AI expense draft not found");
  if (draft.groupId !== groupId) {
    throw new ConvexError("AI expense draft does not belong to the current group");
  }
  if (draft.status !== "registered") {
    throw new ConvexError("Only registered AI expense drafts can be edited from history");
  }
  if (
    draft.registeredReceiptId !== undefined ||
    draft.derivedRegistration?.destination === "receipt"
  ) {
    throw new ConvexError("Legacy receipt registrations cannot be edited from history");
  }
  if (!isValidIsoDateString(args.date)) throw new ConvexError("Date must be valid");
  if (!validateExpenseAmount(args.amountYen).success) {
    throw new ConvexError("Amount must be a positive integer");
  }
  const title = validateExpenseTitle(args.shopName);
  if (!title.success) throw new ConvexError("Shop name is required");
  await assertActiveCategoryBelongsToGroup(ctx, args.categoryId, groupId);

  const now = Date.now();
  if (args.registrationMode === "detailed" && args.items !== undefined) {
    assertPositiveCategoryTotals(args.items);
    await replaceDraftItemsForReview(ctx, args.draftId, groupId, args.items, now);
  }
  await ctx.db.patch(args.draftId, {
    date: args.date,
    amountYen: args.amountYen,
    categoryId: args.categoryId,
    shopName: title.title,
    registrationMode: args.registrationMode,
    receiptTotalResolution: resolveReceiptTotal({
      amountYen: args.amountYen,
      source: "user_confirmed",
      confidence: 1,
      supportingCandidates: draft.receiptTotalResolution?.candidates.filter(
        (candidate) => candidate.source !== "user_confirmed",
      ),
      taxSummaries: draft.taxSummaries ?? [],
    }),
    updatedAt: now,
  });
  const updated = await persistReceiptUserOverrideSnapshot(ctx, {
    draftId: args.draftId,
    groupId,
    fields: [
      "date",
      "amountYen",
      "categoryId",
      "shopName",
      "registrationMode",
      "receiptTotalResolution",
      ...(args.items === undefined ? [] : ["items"]),
    ],
    updatedAt: now,
  });
  const items = await ctx.db
    .query("aiExpenseDraftItems")
    .withIndex("by_group_id_and_draft_id", (q) =>
      q.eq("groupId", groupId).eq("draftId", args.draftId),
    )
    .order("asc")
    .take(100);
  const registrationItems = buildDraftRegistrationItems(updated, items);
  const expenseEntryIds = await reconcileDraftExpenseEntries(ctx, {
    draft: updated,
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
      registrationMode: args.registrationMode,
      ...(args.registrationMode === "totalOnly"
        ? { taxRatePercent: null, taxableAmountYen: null, taxYen: null }
        : {}),
      amountYen: args.amountYen,
      date: args.date,
      categoryIds: [...new Set(registrationItems.map((item) => item.categoryId))],
      registeredAt: draft.derivedRegistration?.registeredAt ?? now,
    },
    updatedAt: now,
  });
  return { draftId: args.draftId, expenseEntryIds };
}

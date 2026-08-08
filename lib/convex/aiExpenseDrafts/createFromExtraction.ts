import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  type AiExpenseDraftConfidence,
  type AiExpenseDraftDocumentType,
  type AiExpenseDraftReviewReason,
} from "../../../lib/domain/aiExpenseDrafts/constants";
import {
  classifyCreatedDraft,
  type CreatedDraftClassificationInput,
} from "../../../lib/domain/aiExpenseDrafts/classification";
import { requireGroupMembership } from "../../../convex/groups/membership";
import { deleteDraftAndItems } from "./draftRepository";
import type {
  AmountBasis,
  ExtractedTaxSummary,
  ReceiptItemTaxRatePercent,
} from "../receiptImageExtraction/types";
import type { ReceiptMarkerDefinition } from "../../receiptTax/types";
import type { TaxResolutionSource } from "../../receiptTax/types";

type AiExpenseDraftItemInput = {
  itemName: string;
  amountYen: number;
  printedAmountYen?: number;
  amountBasis?: AmountBasis;
  taxRatePercent?: ReceiptItemTaxRatePercent;
  markers?: string[];
  taxMarker?: string;
  allocatedTaxYen?: number;
  normalizedAmountYen?: number;
  taxResolutionStatus?: "resolved" | "unresolved";
  taxResolutionSource?: TaxResolutionSource;
  taxReviewReasons?: string[];
  quantity?: number;
  unitPriceYen?: number;
  categoryName?: string;
  categoryId?: Id<"categories">;
  confidence: {
    itemName?: number;
    amountYen?: number;
    categoryName?: number;
    categoryId?: number;
  };
  warnings?: string[];
};

export type CreateFromExtractionArgs = {
  documentType: AiExpenseDraftDocumentType;
  shopName?: string;
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  date?: string;
  amountYen?: number;
  taxSummaries?: ExtractedTaxSummary[];
  markerDefinitions?: ReceiptMarkerDefinition[];
  categoryId?: Id<"categories">;
  imageFileName?: string;
  confidence: AiExpenseDraftConfidence;
  warnings: string[];
  reviewReasons?: AiExpenseDraftReviewReason[];
  items?: AiExpenseDraftItemInput[];
};

export type CreateFailedDraftFromImageAnalysisArgs = {
  warning: string;
  imageFileName?: string;
};

async function assertCategoryBelongsToGroup(
  ctx: Pick<MutationCtx, "db">,
  categoryId: Id<"categories"> | undefined,
  groupId: Id<"groups">,
) {
  if (categoryId === undefined) {
    return;
  }
  const category = await ctx.db.get(categoryId);
  if (category === null || category.groupId !== groupId) {
    throw new ConvexError("Category does not belong to the current group");
  }
}

async function insertDraftItems(
  ctx: Pick<MutationCtx, "db">,
  groupId: Id<"groups">,
  draftId: Id<"aiExpenseDrafts">,
  items: AiExpenseDraftItemInput[],
  now: number,
) {
  for (const item of items) {
    await assertCategoryBelongsToGroup(ctx, item.categoryId, groupId);
    await ctx.db.insert("aiExpenseDraftItems", {
      groupId,
      draftId,
      itemName: item.itemName,
      amountYen: item.amountYen,
      printedAmountYen: item.printedAmountYen,
      amountBasis: item.amountBasis,
      taxRatePercent: item.taxRatePercent,
      markers: item.markers,
      taxMarker: item.taxMarker,
      allocatedTaxYen: item.allocatedTaxYen,
      normalizedAmountYen: item.normalizedAmountYen,
      taxResolutionStatus: item.taxResolutionStatus,
      taxResolutionSource: item.taxResolutionSource,
      taxReviewReasons: item.taxReviewReasons,
      quantity: item.quantity,
      unitPriceYen: item.unitPriceYen,
      categoryName: item.categoryName,
      categoryId: item.categoryId,
      confidence: item.confidence,
      warnings: item.warnings,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function createFromExtractionHandler(
  ctx: MutationCtx,
  args: CreateFromExtractionArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  await assertCategoryBelongsToGroup(ctx, args.categoryId, groupId);

  const now = Date.now();
  const classification = classifyCreatedDraft(args as CreatedDraftClassificationInput);
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId,
    sourceType: "image_upload",
    status: classification.status,
    documentType: args.documentType,
    imageFileName: args.imageFileName,
    shopName: args.shopName,
    paymentPlace: args.paymentPlace,
    payeeName: args.payeeName,
    paymentPurpose: args.paymentPurpose,
    date: args.date,
    amountYen: args.amountYen,
    taxSummaries: args.taxSummaries,
    markerDefinitions: args.markerDefinitions,
    categoryId: args.categoryId,
    confidence: args.confidence,
    warnings: args.warnings,
    reviewReasons: classification.reviewReasons,
    createdAt: now,
    updatedAt: now,
  });

  await insertDraftItems(ctx, groupId, draftId, args.items ?? [], now);

  const draft = await ctx.db.get(draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft was not found after creation");
  }
  return draft;
}

export async function createFailedDraftFromImageAnalysisHandler(
  ctx: MutationCtx,
  args: CreateFailedDraftFromImageAnalysisArgs,
) {
  const { groupId } = await requireGroupMembership(ctx);
  const now = Date.now();
  const draftId = await ctx.db.insert("aiExpenseDrafts", {
    groupId,
    sourceType: "image_upload",
    status: "failed",
    documentType: "unknown",
    imageFileName: args.imageFileName,
    confidence: {},
    warnings: [args.warning],
    reviewReasons: ["parse_failed"],
    createdAt: now,
    updatedAt: now,
  });

  const draft = await ctx.db.get(draftId);
  if (draft === null) {
    throw new ConvexError("AI expense draft was not found after creation");
  }
  return draft;
}

export async function deleteOrphanedDraftHandler(
  ctx: MutationCtx,
  args: { draftId: Id<"aiExpenseDrafts"> },
) {
  const { groupId } = await requireGroupMembership(ctx);
  await deleteDraftAndItems(ctx, args.draftId, groupId);
}

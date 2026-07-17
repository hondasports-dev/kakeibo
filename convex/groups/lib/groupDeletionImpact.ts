import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

const PREVIEW_LIMIT = 100;

export type GroupDeletionPreviewCount = {
  count: number;
  accuracy: "exact" | "at_least" | "unknown";
};

export type GroupDeletionImpactCounts = {
  members: GroupDeletionPreviewCount;
  invitations: GroupDeletionPreviewCount;
  sourceDocuments: GroupDeletionPreviewCount;
  receiptImages: GroupDeletionPreviewCount;
  expenseEntries: GroupDeletionPreviewCount;
  receipts: GroupDeletionPreviewCount;
  categories: GroupDeletionPreviewCount;
  aiDrafts: GroupDeletionPreviewCount;
  aiDraftItems: GroupDeletionPreviewCount;
  analysisBatches: GroupDeletionPreviewCount;
  analysisJobs: GroupDeletionPreviewCount;
  weekSessions: GroupDeletionPreviewCount;
};

async function boundedCount<Document>(query: { take(limit: number): Promise<Document[]> }) {
  const documents = await query.take(PREVIEW_LIMIT + 1);
  return {
    documents: documents.slice(0, PREVIEW_LIMIT),
    result:
      documents.length > PREVIEW_LIMIT
        ? ({ count: PREVIEW_LIMIT, accuracy: "at_least" } as const)
        : ({ count: documents.length, accuracy: "exact" } as const),
  };
}

export async function countGroupDeletionImpact(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
): Promise<GroupDeletionImpactCounts> {
  const members = await boundedCount(
    ctx.db.query("groupMembers").withIndex("by_group_id", (q) => q.eq("groupId", groupId)),
  );
  const invitations = await boundedCount(
    ctx.db.query("groupInvitations").withIndex("by_group_id", (q) => q.eq("groupId", groupId)),
  );
  const sourceDocuments = await boundedCount(
    ctx.db
      .query("sourceDocuments")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const expenseEntries = await boundedCount(
    ctx.db
      .query("expenseEntries")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const receipts = await boundedCount(
    ctx.db.query("receipts").withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const categories = await boundedCount(
    ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId)),
  );
  const aiDrafts = await boundedCount(
    ctx.db
      .query("aiExpenseDrafts")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  const aiDraftItems = await boundedCount(
    ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId)),
  );
  const analysisBatches = await boundedCount(
    ctx.db
      .query("receiptAnalysisBatches")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  const analysisJobs = await boundedCount(
    ctx.db
      .query("receiptAnalysisImageJobs")
      .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId)),
  );
  const weekSessions = await boundedCount(
    ctx.db
      .query("weekSessions")
      .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId)),
  );

  return {
    members: members.result,
    invitations: invitations.result,
    sourceDocuments: sourceDocuments.result,
    receiptImages:
      sourceDocuments.result.accuracy === "exact"
        ? {
            count: sourceDocuments.documents.filter(
              (document) => document.imageStorageId !== undefined,
            ).length,
            accuracy: "exact",
          }
        : { count: 0, accuracy: "unknown" },
    expenseEntries: expenseEntries.result,
    receipts: receipts.result,
    categories: categories.result,
    aiDrafts: aiDrafts.result,
    aiDraftItems: aiDraftItems.result,
    analysisBatches: analysisBatches.result,
    analysisJobs: analysisJobs.result,
    weekSessions: weekSessions.result,
  };
}

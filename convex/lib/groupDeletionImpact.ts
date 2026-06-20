import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type GroupDeletionImpactCounts = {
  members: number;
  invitations: number;
  sourceDocuments: number;
  expenseEntries: number;
  receipts: number;
  categories: number;
  aiDrafts: number;
  analysisBatches: number;
  analysisJobs: number;
};

async function readQueryDocs<T>(query: {
  collect?: () => Promise<T[]>;
  take?: (count: number) => Promise<T[]>;
}) {
  if (typeof query.collect === "function") {
    return await query.collect();
  }
  if (typeof query.take === "function") {
    return await query.take(100);
  }
  return [];
}

export async function countGroupDeletionImpact(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
): Promise<GroupDeletionImpactCounts> {
  const members = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_group_id", (q) => q.eq("groupId", groupId)),
  );

  const invitationStatuses = ["pending", "accepted", "revoked", "expired"] as const;
  let invitations = 0;
  for (const status of invitationStatuses) {
    const statusInvitations = await readQueryDocs(
      ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", status)),
    );
    invitations += statusInvitations.length;
  }

  const sourceDocuments = await readQueryDocs(
    ctx.db
      .query("sourceDocuments")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const expenseEntries = await readQueryDocs(
    ctx.db
      .query("expenseEntries")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const receipts = await readQueryDocs(
    ctx.db.query("receipts").withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  const categories = await readQueryDocs(
    ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId)),
  );
  const aiDrafts = await readQueryDocs(
    ctx.db
      .query("aiExpenseDrafts")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  const analysisBatches = await readQueryDocs(
    ctx.db
      .query("receiptAnalysisBatches")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  const analysisJobs = await readQueryDocs(
    ctx.db
      .query("receiptAnalysisImageJobs")
      .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId)),
  );

  return {
    members: members.length,
    invitations,
    sourceDocuments: sourceDocuments.length,
    expenseEntries: expenseEntries.length,
    receipts: receipts.length,
    categories: categories.length,
    aiDrafts: aiDrafts.length,
    analysisBatches: analysisBatches.length,
    analysisJobs: analysisJobs.length,
  };
}

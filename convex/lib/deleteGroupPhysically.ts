import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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

/**
 * グループに紐づく Convex データをすべて物理削除する。
 * `users` と Clerk アカウントは削除しない。
 */
export async function deleteAllGroupScopedData(ctx: MutationCtx, groupId: Id<"groups">) {
  const receiptAnalysisImageJobs = await readQueryDocs(
    ctx.db
      .query("receiptAnalysisImageJobs")
      .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId)),
  );
  for (const job of receiptAnalysisImageJobs) {
    await ctx.db.delete(job._id);
  }

  const aiExpenseDraftItems = await readQueryDocs(
    ctx.db
      .query("aiExpenseDraftItems")
      .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId)),
  );
  for (const item of aiExpenseDraftItems) {
    await ctx.db.delete(item._id);
  }

  const aiExpenseDrafts = await readQueryDocs(
    ctx.db
      .query("aiExpenseDrafts")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  for (const draft of aiExpenseDrafts) {
    await ctx.db.delete(draft._id);
  }

  const receiptAnalysisBatches = await readQueryDocs(
    ctx.db
      .query("receiptAnalysisBatches")
      .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId)),
  );
  for (const batch of receiptAnalysisBatches) {
    await ctx.db.delete(batch._id);
  }

  const expenseEntries = await readQueryDocs(
    ctx.db
      .query("expenseEntries")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  for (const entry of expenseEntries) {
    await ctx.db.delete(entry._id);
  }

  const receipts = await readQueryDocs(
    ctx.db.query("receipts").withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  for (const receipt of receipts) {
    await ctx.db.delete(receipt._id);
  }

  const sourceDocuments = await readQueryDocs(
    ctx.db
      .query("sourceDocuments")
      .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId)),
  );
  for (const sourceDocument of sourceDocuments) {
    if (sourceDocument.imageStorageId !== undefined) {
      await ctx.storage.delete(sourceDocument.imageStorageId);
    }
    await ctx.db.delete(sourceDocument._id);
  }

  const weekSessions = await readQueryDocs(
    ctx.db
      .query("weekSessions")
      .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId)),
  );
  for (const weekSession of weekSessions) {
    await ctx.db.delete(weekSession._id);
  }

  const categories = await readQueryDocs(
    ctx.db
      .query("categories")
      .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId)),
  );
  for (const category of categories) {
    await ctx.db.delete(category._id);
  }

  const invitationStatuses = ["pending", "accepted", "revoked", "expired"] as const;
  for (const status of invitationStatuses) {
    const invitations = await readQueryDocs(
      ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", status)),
    );
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }
  }

  const groupMembers = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_group_id", (q) => q.eq("groupId", groupId)),
  );
  for (const member of groupMembers) {
    await ctx.db.delete(member._id);
  }

  await ctx.db.delete(groupId);
}

import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireGroupMembership } from "../groups/membership";

export async function listBatchesHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);
  return await ctx.db
    .query("receiptAnalysisBatches")
    .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
    .order("desc")
    .take(50);
}

export async function listJobsHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);
  return await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId))
    .order("desc")
    .take(100);
}

export async function listJobsByBatchHandler(
  ctx: QueryCtx,
  { batchId }: { batchId: Id<"receiptAnalysisBatches"> },
) {
  const { groupId } = await requireGroupMembership(ctx);
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.groupId !== groupId) {
    throw new ConvexError("Batch not found");
  }
  return await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_batch_id", (q) => q.eq("batchId", batchId))
    .order("asc")
    .take(50);
}

export async function getJobByDraftIdHandler(
  ctx: QueryCtx,
  { draftId }: { draftId: Id<"aiExpenseDrafts"> },
) {
  const { groupId } = await requireGroupMembership(ctx);
  const job = await ctx.db
    .query("receiptAnalysisImageJobs")
    .withIndex("by_draft_id", (q) => q.eq("draftId", draftId))
    .unique();
  if (!job || job.groupId !== groupId) {
    return null;
  }
  return job;
}

export const listBatches = query({
  args: {},
  handler: listBatchesHandler,
});

export const listJobs = query({
  args: {},
  handler: listJobsHandler,
});

export const listJobsByBatch = query({
  args: {
    batchId: v.id("receiptAnalysisBatches"),
  },
  handler: listJobsByBatchHandler,
});

export const getJobByDraftId = query({
  args: {
    draftId: v.id("aiExpenseDrafts"),
  },
  handler: getJobByDraftIdHandler,
});

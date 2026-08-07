import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { MAX_ATTEMPTS } from "./groupDeletionConstants";
import { GROUP_DELETION_PURGE_TABLES } from "./groupDeletionRegistry";
import { scheduleBatch } from "./groupDeletionScheduling";

function emptyDeletedCounts() {
  return {
    receiptAnalysisImageJobs: 0,
    aiExpenseDraftItems: 0,
    aiExpenseDrafts: 0,
    receiptAnalysisBatches: 0,
    expenseEntries: 0,
    receipts: 0,
    sourceDocuments: 0,
    storageFiles: 0,
    weekSessions: 0,
    categories: 0,
    groupInvitations: 0,
    managementAuditLogs: 0,
    groupMembers: 0,
    groups: 0,
  };
}

export async function startGroupDeletionHandler(
  ctx: MutationCtx,
  args: {
    groupId: Id<"groups">;
    source: "owner" | "account_deletion" | "e2e_cleanup";
    actorUserIdSnapshot?: string;
  },
) {
  const targetGroupIdSnapshot = args.groupId.toString();
  const activeJobs = await ctx.db
    .query("groupDeletionJobs")
    .withIndex("by_target_group_id_snapshot_and_is_active", (q) =>
      q.eq("targetGroupIdSnapshot", targetGroupIdSnapshot).eq("isActive", true),
    )
    .take(1);

  if (activeJobs.length > 0) {
    throw new ConvexError("このグループの削除処理はすでに開始されています");
  }

  const group = await ctx.db.get(args.groupId);
  if (group === null) {
    throw new ConvexError("削除対象のグループが見つかりません");
  }
  if (group.status === "deleting" || group.status === "deleted") {
    throw new ConvexError("このグループの削除処理はすでに開始されています");
  }
  if (group.status === "archived") {
    throw new ConvexError("アーカイブ済みグループは削除できません");
  }

  const now = Date.now();
  const jobId = await ctx.db.insert("groupDeletionJobs", {
    targetGroupIdSnapshot,
    targetGroupNameSnapshot: group.name,
    source: args.source,
    actorUserIdSnapshot: args.actorUserIdSnapshot,
    status: "requested",
    stage:
      args.source === "owner" && args.actorUserIdSnapshot !== undefined
        ? "recipientSnapshot"
        : GROUP_DELETION_PURGE_TABLES[0],
    isActive: true,
    attemptCount: 0,
    maxAttempts: MAX_ATTEMPTS,
    deletedCounts: emptyDeletedCounts(),
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(args.groupId, {
    status: "deleting",
    updatedAt: now,
  });
  await scheduleBatch(ctx, jobId);
  return jobId;
}

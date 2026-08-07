import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { scheduleBatch } from "./groupDeletionScheduling";

export async function resumeGroupDeletionHandler(
  ctx: MutationCtx,
  args: { jobId: Id<"groupDeletionJobs"> },
) {
  const job = await ctx.db.get(args.jobId);
  if (job === null || job.status !== "failed") {
    throw new ConvexError("failed状態の削除ジョブだけを再開できます");
  }

  const groupId = ctx.db.normalizeId("groups", job.targetGroupIdSnapshot);
  const group = groupId === null ? null : await ctx.db.get(groupId);
  const mayRunAfterGroupDeletion =
    job.stage === "finalSweep" ||
    job.stage === "completedEnqueue" ||
    job.stage === "recipientCleanup";
  if (
    (group === null && !mayRunAfterGroupDeletion) ||
    (group !== null && group.status !== "deleting")
  ) {
    throw new ConvexError("deleting状態のグループに対する削除ジョブだけを再開できます");
  }

  const activeJobs = await ctx.db
    .query("groupDeletionJobs")
    .withIndex("by_target_group_id_snapshot_and_is_active", (q) =>
      q.eq("targetGroupIdSnapshot", job.targetGroupIdSnapshot).eq("isActive", true),
    )
    .take(1);
  if (activeJobs.length > 0) {
    throw new ConvexError("このグループの削除処理はすでに開始されています");
  }

  await ctx.db.patch(job._id, {
    status: "requested",
    isActive: true,
    attemptCount: 0,
    nextRetryAt: undefined,
    lastErrorCategory: undefined,
    completedAt: undefined,
    updatedAt: Date.now(),
  });
  await scheduleBatch(ctx, job._id);
  return null;
}

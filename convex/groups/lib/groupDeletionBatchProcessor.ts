import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { BATCH_SIZE } from "./groupDeletionConstants";
import { scheduleBatch } from "./groupDeletionScheduling";
import { processRecipientNotificationBatch } from "./groupDeletionRecipientNotifications";
import { deleteStageBatch, findRemainingStage, nextStage } from "./groupDeletionStagePurge";
import { recordRetry } from "./groupDeletionBatchRetry";
import type { PurgeStage, StageProgress } from "./groupDeletionTypes";

export async function processGroupDeletionBatchHandler(
  ctx: MutationCtx,
  args: { jobId: Id<"groupDeletionJobs"> },
): Promise<null> {
  const job = await ctx.db.get(args.jobId);
  if (job === null || job.status === "completed" || job.status === "failed") {
    return null;
  }
  const now = Date.now();
  if (job.status === "retry_wait" && job.nextRetryAt !== undefined && job.nextRetryAt > now) {
    await scheduleBatch(ctx, job._id, job.nextRetryAt - now);
    return null;
  }

  const progress: StageProgress = { deleted: 0, storageFiles: 0 };
  let groupDeleted = false;
  try {
    const groupId = ctx.db.normalizeId("groups", job.targetGroupIdSnapshot);
    if (groupId === null) {
      const completedAt = Date.now();
      await ctx.db.patch(job._id, {
        status: "completed",
        stage: "finalSweep",
        isActive: false,
        nextRetryAt: undefined,
        updatedAt: completedAt,
        completedAt,
      });
      return null;
    }

    await ctx.db.patch(job._id, {
      status: "running",
      nextRetryAt: undefined,
      updatedAt: Date.now(),
    });

    if (job.stage === "recipientSnapshot") {
      const page = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .paginate({ cursor: job.snapshotCursor ?? null, numItems: BATCH_SIZE });
      const now = Date.now();
      for (const member of page.page) {
        const existing = await ctx.db
          .query("groupDeletionNotificationRecipients")
          .withIndex("by_job_id_and_recipient_user_id", (q) =>
            q.eq("jobId", job._id).eq("recipientUserId", member.userId),
          )
          .unique();
        if (existing === null) {
          await ctx.db.insert("groupDeletionNotificationRecipients", {
            jobId: job._id,
            recipientUserId: member.userId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await ctx.db.patch(job._id, {
        stage: page.isDone ? "startedEnqueue" : "recipientSnapshot",
        snapshotCursor: page.isDone ? undefined : page.continueCursor,
        updatedAt: now,
      });
      await scheduleBatch(ctx, job._id);
      return null;
    }

    if (job.stage === "startedEnqueue") {
      await processRecipientNotificationBatch(ctx, job, "started");
      return null;
    }

    if (job.stage === "completedEnqueue") {
      await processRecipientNotificationBatch(ctx, job, "completed");
      return null;
    }

    if (job.stage === "recipientCleanup") {
      const recipients = await ctx.db
        .query("groupDeletionNotificationRecipients")
        .withIndex("by_job_id", (q) => q.eq("jobId", job._id))
        .take(BATCH_SIZE);
      if (recipients.length > 0) {
        for (const recipient of recipients) await ctx.db.delete(recipient._id);
        await scheduleBatch(ctx, job._id);
        return null;
      }
      const now = Date.now();
      await ctx.db.patch(job._id, {
        status: "completed",
        isActive: false,
        nextRetryAt: undefined,
        updatedAt: now,
        completedAt: now,
      });
      return null;
    }

    if (job.stage === "finalSweep") {
      const remainingStage = await findRemainingStage(ctx, groupId);
      if (remainingStage !== null) {
        await ctx.db.patch(job._id, {
          stage: remainingStage,
          updatedAt: Date.now(),
        });
        await scheduleBatch(ctx, job._id);
        return null;
      }

      const group = await ctx.db.get(groupId);
      const deletedCounts = { ...job.deletedCounts };
      if (group !== null) {
        await ctx.db.delete(groupId);
        deletedCounts.groups += 1;
        groupDeleted = true;
      }
      const now = Date.now();
      const usesRecipientNotifications =
        job.source === "owner" && job.actorUserIdSnapshot !== undefined;
      await ctx.db.patch(job._id, {
        status: usesRecipientNotifications ? "running" : "completed",
        stage: usesRecipientNotifications ? "completedEnqueue" : "finalSweep",
        isActive: usesRecipientNotifications,
        nextRetryAt: undefined,
        deletedCounts,
        updatedAt: now,
        completedAt: usesRecipientNotifications ? undefined : now,
      });
      if (usesRecipientNotifications) await scheduleBatch(ctx, job._id);
      return null;
    }

    await deleteStageBatch(ctx, groupId, job.stage, progress);
    const deletedCounts = {
      ...job.deletedCounts,
      [job.stage]: job.deletedCounts[job.stage] + progress.deleted,
      storageFiles: job.deletedCounts.storageFiles + progress.storageFiles,
    };
    const stage = progress.deleted === 0 ? nextStage(job.stage) : job.stage;
    await ctx.db.patch(job._id, {
      stage,
      deletedCounts,
      updatedAt: Date.now(),
    });
    await scheduleBatch(ctx, job._id);
  } catch {
    if (job.stage !== "finalSweep" && (progress.deleted > 0 || progress.storageFiles > 0)) {
      const failedStage = job.stage as PurgeStage;
      await ctx.db.patch(job._id, {
        deletedCounts: {
          ...job.deletedCounts,
          [failedStage]: job.deletedCounts[failedStage] + progress.deleted,
          storageFiles: job.deletedCounts.storageFiles + progress.storageFiles,
        },
        updatedAt: Date.now(),
      });
    } else if (groupDeleted) {
      await ctx.db.patch(job._id, {
        deletedCounts: {
          ...job.deletedCounts,
          groups: job.deletedCounts.groups + 1,
        },
        updatedAt: Date.now(),
      });
    }
    const latestJob = (await ctx.db.get(job._id)) ?? job;
    await recordRetry(ctx, latestJob);
  }

  return null;
}

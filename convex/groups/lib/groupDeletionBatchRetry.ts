import type { MutationCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { scheduleBatch, scheduleFailureNotification } from "./groupDeletionScheduling";
import { planGroupDeletionRetry } from "./groupDeletionRetry";

export async function recordRetry(ctx: MutationCtx, job: Doc<"groupDeletionJobs">): Promise<void> {
  const now = Date.now();
  const retryPlan = planGroupDeletionRetry({
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    now,
  });
  if (retryPlan.status === "failed") {
    await ctx.db.patch(job._id, {
      status: "failed",
      isActive: false,
      attemptCount: retryPlan.attemptCount,
      nextRetryAt: undefined,
      lastErrorCategory: "batch_processing_failed",
      updatedAt: now,
    });
    if (
      job.source === "owner" &&
      job.actorUserIdSnapshot &&
      job.failureNotificationHandledAt === undefined
    ) {
      await scheduleFailureNotification(ctx, job._id);
    }
    return;
  }

  await ctx.db.patch(job._id, {
    status: "retry_wait",
    attemptCount: retryPlan.attemptCount,
    nextRetryAt: retryPlan.nextRetryAt,
    lastErrorCategory: "batch_processing_failed",
    updatedAt: now,
  });
  await scheduleBatch(ctx, job._id, retryPlan.delayMs);
}

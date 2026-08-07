import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { FAILURE_NOTIFICATION_MAX_DELAY_MS } from "./groupDeletionConstants";
import { enqueueGroupDeletionFailedEmail } from "./emailNotifications";
import { scheduleFailureNotification } from "./groupDeletionScheduling";

export async function processGroupDeletionFailureNotificationHandler(
  ctx: MutationCtx,
  args: { jobId: Id<"groupDeletionJobs"> },
  enqueueFailureEmail = enqueueGroupDeletionFailedEmail,
) {
  const job = await ctx.db.get(args.jobId);
  if (
    job === null ||
    job.source !== "owner" ||
    !job.actorUserIdSnapshot ||
    job.failureNotificationHandledAt !== undefined
  ) {
    return null;
  }

  const requester = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", job.actorUserIdSnapshot!))
    .unique();
  const attemptCount = (job.failureNotificationAttemptCount ?? 0) + 1;
  if (!requester?.email) {
    const now = Date.now();
    await ctx.db.patch(job._id, {
      failureNotificationAttemptCount: attemptCount,
      failureNotificationHandledAt: now,
      updatedAt: now,
    });
    return null;
  }

  try {
    await enqueueFailureEmail(
      ctx,
      job.targetGroupNameSnapshot,
      job._id.toString(),
      requester.email,
      `${job._id}:failed:${job.actorUserIdSnapshot}`,
    );
    const now = Date.now();
    await ctx.db.patch(job._id, {
      failureNotificationAttemptCount: attemptCount,
      failureNotificationHandledAt: now,
      updatedAt: now,
    });
  } catch {
    const delayMs = Math.min(
      60_000 * 2 ** Math.min(attemptCount - 1, 8),
      FAILURE_NOTIFICATION_MAX_DELAY_MS,
    );
    await ctx.db.patch(job._id, {
      failureNotificationAttemptCount: attemptCount,
      updatedAt: Date.now(),
    });
    await scheduleFailureNotification(ctx, job._id, delayMs);
  }
  return null;
}

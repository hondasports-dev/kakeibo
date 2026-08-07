import type { MutationCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { BATCH_SIZE } from "./groupDeletionConstants";
import { GROUP_DELETION_PURGE_TABLES } from "./groupDeletionRegistry";
import { scheduleBatch } from "./groupDeletionScheduling";
import { enqueueGroupDeletedEmail, enqueueGroupDeletionStartedEmail } from "./emailNotifications";

export async function processRecipientNotificationBatch(
  ctx: MutationCtx,
  job: Doc<"groupDeletionJobs">,
  event: "started" | "completed",
) {
  const indexName =
    event === "started" ? "by_job_id_and_started_handled_at" : "by_job_id_and_completed_handled_at";
  const recipients = await ctx.db
    .query("groupDeletionNotificationRecipients")
    .withIndex(indexName, (q) => q.eq("jobId", job._id).eq(`${event}HandledAt`, undefined))
    .take(BATCH_SIZE);

  if (recipients.length === 0) {
    await ctx.db.patch(job._id, {
      stage: event === "started" ? GROUP_DELETION_PURGE_TABLES[0] : "recipientCleanup",
      updatedAt: Date.now(),
    });
    await scheduleBatch(ctx, job._id);
    return;
  }

  const now = Date.now();
  for (const recipient of recipients) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", recipient.recipientUserId))
      .unique();
    const businessDedupeKey = `${job._id}:${event}:${recipient.recipientUserId}`;
    if (event === "started") {
      await enqueueGroupDeletionStartedEmail(
        ctx,
        job.targetGroupNameSnapshot,
        user?.email,
        businessDedupeKey,
      );
      await ctx.db.patch(recipient._id, { startedHandledAt: now, updatedAt: now });
    } else {
      await enqueueGroupDeletedEmail(
        ctx,
        job.targetGroupNameSnapshot,
        user?.email,
        businessDedupeKey,
      );
      await ctx.db.patch(recipient._id, { completedHandledAt: now, updatedAt: now });
    }
  }
  await scheduleBatch(ctx, job._id);
}

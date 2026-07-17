import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import {
  type GroupDeletionStage,
  groupDeletionCountsValidator,
  groupDeletionSourceValidator,
  groupDeletionStageValidator,
  groupDeletionStatusValidator,
} from "./lib/groupDeletionJobModel";
import { GROUP_DELETION_PURGE_TABLES } from "./lib/groupDeletionRegistry";
import { planGroupDeletionRetry } from "./lib/groupDeletionRetry";
import {
  enqueueGroupDeletedEmail,
  enqueueGroupDeletionFailedEmail,
  enqueueGroupDeletionStartedEmail,
} from "./lib/emailNotifications";

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 25;
const FAILURE_NOTIFICATION_MAX_DELAY_MS = 6 * 60 * 60_000;

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

function nextStage(stage: GroupDeletionStage): GroupDeletionStage {
  const stages: ReadonlyArray<GroupDeletionStage> = [
    ...GROUP_DELETION_PURGE_TABLES,
    "finalSweep",
    "completedEnqueue",
    "recipientCleanup",
  ];
  const currentIndex = stages.indexOf(stage);
  return stages[Math.min(currentIndex + 1, stages.length - 1)];
}

async function scheduleBatch(ctx: MutationCtx, jobId: Id<"groupDeletionJobs">, delayMs = 0) {
  await ctx.scheduler.runAfter(delayMs, internal.groups.groupDeletion.processGroupDeletionBatch, {
    jobId,
  });
}

async function scheduleFailureNotification(
  ctx: MutationCtx,
  jobId: Id<"groupDeletionJobs">,
  delayMs = 0,
) {
  await ctx.scheduler.runAfter(
    delayMs,
    internal.groups.groupDeletion.processGroupDeletionFailureNotification,
    { jobId },
  );
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

type SimplePurgeTable = Exclude<
  (typeof GROUP_DELETION_PURGE_TABLES)[number],
  "sourceDocuments" | "groupMembers"
>;

type PurgeStage = (typeof GROUP_DELETION_PURGE_TABLES)[number];

type StageProgress = { deleted: number; storageFiles: number };

async function processRecipientNotificationBatch(
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

async function deleteSimpleDocuments<TableName extends SimplePurgeTable>(
  ctx: MutationCtx,
  documents: Array<{ _id: Id<TableName> }>,
  progress: StageProgress,
): Promise<void> {
  for (const document of documents) {
    await ctx.db.delete(document._id);
    progress.deleted += 1;
  }
}

async function deleteStageBatch(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  stage: PurgeStage,
  progress: StageProgress,
): Promise<void> {
  switch (stage) {
    case "receiptAnalysisImageJobs": {
      const documents = await ctx.db
        .query("receiptAnalysisImageJobs")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "aiExpenseDraftItems": {
      const documents = await ctx.db
        .query("aiExpenseDraftItems")
        .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "aiExpenseDrafts": {
      const documents = await ctx.db
        .query("aiExpenseDrafts")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "receiptAnalysisBatches": {
      const documents = await ctx.db
        .query("receiptAnalysisBatches")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "expenseEntries": {
      const documents = await ctx.db
        .query("expenseEntries")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "receipts": {
      const documents = await ctx.db
        .query("receipts")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "sourceDocuments": {
      const documents = await ctx.db
        .query("sourceDocuments")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      for (const document of documents) {
        if (document.imageStorageId !== undefined) {
          const metadata = await ctx.db.system.get("_storage", document.imageStorageId);
          if (metadata !== null) {
            await ctx.storage.delete(document.imageStorageId);
            progress.storageFiles += 1;
          }
        }
        await ctx.db.delete(document._id);
        progress.deleted += 1;
      }
      return;
    }
    case "weekSessions": {
      const documents = await ctx.db
        .query("weekSessions")
        .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "categories": {
      const documents = await ctx.db
        .query("categories")
        .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "groupInvitations": {
      const documents = await ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "managementAuditLogs": {
      const documents = await ctx.db
        .query("managementAuditLogs")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return await deleteSimpleDocuments(ctx, documents, progress);
    }
    case "groupMembers": {
      const documents = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      for (const member of documents) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token_identifier", (q) => q.eq("userId", member.userId))
          .first();
        if (user?.activeGroupId === groupId) {
          await ctx.db.patch(user._id, { activeGroupId: undefined, updatedAt: Date.now() });
        }
        await ctx.db.delete(member._id);
        progress.deleted += 1;
      }
      return;
    }
  }
}

async function hasDocumentsForStage(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  stage: PurgeStage,
): Promise<boolean> {
  switch (stage) {
    case "receiptAnalysisImageJobs":
      return (
        (
          await ctx.db
            .query("receiptAnalysisImageJobs")
            .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "aiExpenseDraftItems":
      return (
        (
          await ctx.db
            .query("aiExpenseDraftItems")
            .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "aiExpenseDrafts":
      return (
        (
          await ctx.db
            .query("aiExpenseDrafts")
            .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "receiptAnalysisBatches":
      return (
        (
          await ctx.db
            .query("receiptAnalysisBatches")
            .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "expenseEntries":
      return (
        (
          await ctx.db
            .query("expenseEntries")
            .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "receipts":
      return (
        (
          await ctx.db
            .query("receipts")
            .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "sourceDocuments":
      return (
        (
          await ctx.db
            .query("sourceDocuments")
            .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "weekSessions":
      return (
        (
          await ctx.db
            .query("weekSessions")
            .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "categories":
      return (
        (
          await ctx.db
            .query("categories")
            .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "groupInvitations":
      return (
        (
          await ctx.db
            .query("groupInvitations")
            .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "managementAuditLogs":
      return (
        (
          await ctx.db
            .query("managementAuditLogs")
            .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
    case "groupMembers":
      return (
        (
          await ctx.db
            .query("groupMembers")
            .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
            .take(1)
        ).length > 0
      );
  }
}

async function findRemainingStage(
  ctx: MutationCtx,
  groupId: Id<"groups">,
): Promise<PurgeStage | null> {
  for (const stage of GROUP_DELETION_PURGE_TABLES) {
    if (await hasDocumentsForStage(ctx, groupId, stage)) {
      return stage;
    }
  }
  return null;
}

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

export const processGroupDeletionFailureNotification = internalMutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => await processGroupDeletionFailureNotificationHandler(ctx, args),
});

export const startGroupDeletion = internalMutation({
  args: {
    groupId: v.id("groups"),
    source: groupDeletionSourceValidator,
    actorUserIdSnapshot: v.optional(v.string()),
  },
  returns: v.id("groupDeletionJobs"),
  handler: startGroupDeletionHandler,
});

export const getGroupDeletionStatus = internalQuery({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("groupDeletionJobs"),
      targetGroupIdSnapshot: v.string(),
      targetGroupNameSnapshot: v.string(),
      source: groupDeletionSourceValidator,
      actorUserIdSnapshot: v.optional(v.string()),
      status: groupDeletionStatusValidator,
      stage: groupDeletionStageValidator,
      isActive: v.boolean(),
      attemptCount: v.number(),
      maxAttempts: v.number(),
      nextRetryAt: v.optional(v.number()),
      lastErrorCategory: v.optional(v.string()),
      snapshotCursor: v.optional(v.string()),
      failureNotificationHandledAt: v.optional(v.number()),
      deletedCounts: groupDeletionCountsValidator,
      createdAt: v.number(),
      updatedAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job === null) {
      return null;
    }
    return {
      jobId: job._id,
      targetGroupIdSnapshot: job.targetGroupIdSnapshot,
      targetGroupNameSnapshot: job.targetGroupNameSnapshot,
      source: job.source,
      actorUserIdSnapshot: job.actorUserIdSnapshot,
      status: job.status,
      stage: job.stage,
      isActive: job.isActive,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextRetryAt: job.nextRetryAt,
      lastErrorCategory: job.lastErrorCategory,
      snapshotCursor: job.snapshotCursor,
      failureNotificationHandledAt: job.failureNotificationHandledAt,
      deletedCounts: job.deletedCounts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  },
});

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

export const resumeGroupDeletion = internalMutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: resumeGroupDeletionHandler,
});

export const processGroupDeletionBatch = internalMutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
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
        const now = Date.now();
        await ctx.db.patch(job._id, {
          status: "completed",
          stage: "finalSweep",
          isActive: false,
          nextRetryAt: undefined,
          updatedAt: now,
          completedAt: now,
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
  },
});

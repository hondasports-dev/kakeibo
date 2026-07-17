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

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 25;

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
  const stages: ReadonlyArray<GroupDeletionStage> = [...GROUP_DELETION_PURGE_TABLES, "finalSweep"];
  const currentIndex = stages.indexOf(stage);
  return stages[Math.min(currentIndex + 1, stages.length - 1)];
}

async function scheduleBatch(ctx: MutationCtx, jobId: Id<"groupDeletionJobs">, delayMs = 0) {
  await ctx.scheduler.runAfter(delayMs, internal.groups.groupDeletion.processGroupDeletionBatch, {
    jobId,
  });
}

type SimplePurgeTable = Exclude<
  (typeof GROUP_DELETION_PURGE_TABLES)[number],
  "sourceDocuments" | "groupMembers"
>;

async function deleteSimpleDocuments<TableName extends SimplePurgeTable>(
  ctx: MutationCtx,
  documents: Array<{ _id: Id<TableName> }>,
): Promise<number> {
  for (const document of documents) {
    await ctx.db.delete(document._id);
  }
  return documents.length;
}

async function deleteStageBatch(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  stage: Exclude<GroupDeletionStage, "finalSweep">,
): Promise<{ deleted: number; storageFiles: number }> {
  switch (stage) {
    case "receiptAnalysisImageJobs": {
      const documents = await ctx.db
        .query("receiptAnalysisImageJobs")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "aiExpenseDraftItems": {
      const documents = await ctx.db
        .query("aiExpenseDraftItems")
        .withIndex("by_group_id_and_draft_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "aiExpenseDrafts": {
      const documents = await ctx.db
        .query("aiExpenseDrafts")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "receiptAnalysisBatches": {
      const documents = await ctx.db
        .query("receiptAnalysisBatches")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "expenseEntries": {
      const documents = await ctx.db
        .query("expenseEntries")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "receipts": {
      const documents = await ctx.db
        .query("receipts")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "sourceDocuments": {
      const documents = await ctx.db
        .query("sourceDocuments")
        .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      let storageFiles = 0;
      for (const document of documents) {
        if (document.imageStorageId !== undefined) {
          const metadata = await ctx.db.system.get("_storage", document.imageStorageId);
          if (metadata !== null) {
            await ctx.storage.delete(document.imageStorageId);
            storageFiles += 1;
          }
        }
        await ctx.db.delete(document._id);
      }
      return { deleted: documents.length, storageFiles };
    }
    case "weekSessions": {
      const documents = await ctx.db
        .query("weekSessions")
        .withIndex("by_group_id_and_week_start_date", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "categories": {
      const documents = await ctx.db
        .query("categories")
        .withIndex("by_group_id_and_sort_order", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "groupInvitations": {
      const documents = await ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
    }
    case "managementAuditLogs": {
      const documents = await ctx.db
        .query("managementAuditLogs")
        .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      return { deleted: await deleteSimpleDocuments(ctx, documents), storageFiles: 0 };
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
      }
      return { deleted: documents.length, storageFiles: 0 };
    }
  }
}

async function hasDocumentsForStage(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  stage: Exclude<GroupDeletionStage, "finalSweep">,
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
): Promise<Exclude<GroupDeletionStage, "finalSweep"> | null> {
  for (const stage of GROUP_DELETION_PURGE_TABLES) {
    if (await hasDocumentsForStage(ctx, groupId, stage)) {
      return stage;
    }
  }
  return null;
}

async function recordRetry(ctx: MutationCtx, job: Doc<"groupDeletionJobs">): Promise<void> {
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

export const startGroupDeletion = internalMutation({
  args: {
    groupId: v.id("groups"),
    source: groupDeletionSourceValidator,
    actorUserIdSnapshot: v.optional(v.string()),
  },
  returns: v.id("groupDeletionJobs"),
  handler: async (ctx, args) => {
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
      stage: GROUP_DELETION_PURGE_TABLES[0],
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
    await ctx.scheduler.runAfter(0, internal.groups.groupDeletion.processGroupDeletionBatch, {
      jobId,
    });

    return jobId;
  },
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
      deletedCounts: job.deletedCounts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  },
});

export const resumeGroupDeletion = internalMutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job === null || job.status !== "failed") {
      throw new ConvexError("failed状態の削除ジョブだけを再開できます");
    }

    const groupId = ctx.db.normalizeId("groups", job.targetGroupIdSnapshot);
    const group = groupId === null ? null : await ctx.db.get(groupId);
    if (group === null || group.status !== "deleting") {
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
  },
});

export const processGroupDeletionBatch = internalMutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job === null || job.status === "completed" || job.status === "failed") {
      return null;
    }

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
        }
        const now = Date.now();
        await ctx.db.patch(job._id, {
          status: "completed",
          isActive: false,
          nextRetryAt: undefined,
          deletedCounts,
          updatedAt: now,
          completedAt: now,
        });
        return null;
      }

      const result = await deleteStageBatch(ctx, groupId, job.stage);
      const deletedCounts = {
        ...job.deletedCounts,
        [job.stage]: job.deletedCounts[job.stage] + result.deleted,
        storageFiles: job.deletedCounts.storageFiles + result.storageFiles,
      };
      const stage = result.deleted === 0 ? nextStage(job.stage) : job.stage;
      await ctx.db.patch(job._id, {
        stage,
        deletedCounts,
        updatedAt: Date.now(),
      });
      await scheduleBatch(ctx, job._id);
    } catch {
      await recordRetry(ctx, job);
    }

    return null;
  },
});

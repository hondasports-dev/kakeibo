import type { MutationCtx } from "../../_generated/server";
import type { Id, TableNames } from "../../_generated/dataModel";
import { BATCH_SIZE } from "./groupDeletionConstants";
import { GROUP_DELETION_PURGE_TABLES } from "./groupDeletionRegistry";
import type { GroupDeletionStage } from "./groupDeletionJobModel";
import type { PurgeStage, StageProgress } from "./groupDeletionTypes";

export async function deleteSimpleDocuments(
  ctx: MutationCtx,
  documents: Array<{ _id: Id<TableNames> }>,
  progress: StageProgress,
): Promise<void> {
  for (const document of documents) {
    await ctx.db.delete(document._id);
    progress.deleted += 1;
  }
}

export async function deleteStageBatch(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  stage: PurgeStage,
  progress: StageProgress,
): Promise<void> {
  switch (stage) {
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
    case "groupMembers": {
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(BATCH_SIZE);
      for (const member of members) {
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
  }
}

export async function hasDocumentsForStage(
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

export async function findRemainingStage(
  ctx: MutationCtx,
  groupId: Id<"groups">,
): Promise<PurgeStage | null> {
  for (const stage of GROUP_DELETION_PURGE_TABLES) {
    if (await hasDocumentsForStage(ctx, groupId, stage as PurgeStage)) {
      return stage as PurgeStage;
    }
  }
  return null;
}

export function nextStage(stage: GroupDeletionStage): GroupDeletionStage {
  const stages: ReadonlyArray<GroupDeletionStage> = [
    ...GROUP_DELETION_PURGE_TABLES,
    "finalSweep",
    "completedEnqueue",
    "recipientCleanup",
  ];
  const currentIndex = stages.indexOf(stage);
  return stages[Math.min(currentIndex + 1, stages.length - 1)];
}

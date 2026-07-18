import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const BATCH_SIZE = 25;
const COUNT_KEYS = [
  "receiptAnalysisImageJobs",
  "aiExpenseDraftItems",
  "aiExpenseDrafts",
  "receiptAnalysisBatches",
  "expenseEntries",
  "receipts",
  "sourceDocuments",
  "storageFiles",
  "weekSessions",
  "categories",
  "groupInvitations",
  "managementAuditLogs",
  "groupMembers",
  "groups",
] as const;

type DeletedCounts = Record<(typeof COUNT_KEYS)[number], number>;
function emptyDeletedCounts(): DeletedCounts {
  return Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as DeletedCounts;
}

function parseDeletedCounts(afterValue: string | undefined) {
  if (!afterValue) return { status: "skipped" as const, reason: "missing_after_value" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(afterValue);
  } catch {
    return { status: "skipped" as const, reason: "invalid_after_value_json" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { status: "skipped" as const, reason: "invalid_after_value_shape" };
  }
  const source = parsed as Record<string, unknown>;
  const candidate = source.affectedCounts ?? source.deletedCounts;
  if (typeof candidate !== "object" || candidate === null) {
    return { status: "skipped" as const, reason: "missing_deleted_counts" };
  }
  const counts = emptyDeletedCounts();
  let recognized = false;
  for (const key of COUNT_KEYS) {
    const value = (candidate as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return { status: "skipped" as const, reason: "invalid_deleted_count" };
    }
    counts[key] = value;
    recognized = true;
  }
  if (!recognized) return { status: "skipped" as const, reason: "missing_deleted_counts" };
  return { status: "migrated" as const, counts };
}

async function loadOrphanedPage(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  cursor: string | null,
) {
  return await ctx.db
    .query("managementAuditLogs")
    .withIndex("by_action_and_created_at", (q) => q.eq("action", "group_deleted"))
    .paginate({ cursor, numItems: BATCH_SIZE });
}

const migrationResultValidator = v.object({
  isDone: v.boolean(),
  continueCursor: v.union(v.string(), v.null()),
  migrated: v.number(),
  skipped: v.number(),
  alreadyProcessed: v.number(),
});

export const dryRun = internalQuery({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    orphaned: v.number(),
    convertible: v.number(),
    skipped: v.number(),
    alreadyProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await loadOrphanedPage(ctx, args.cursor ?? null);
    let orphaned = 0;
    let convertible = 0;
    let skipped = 0;
    let alreadyProcessed = 0;
    for (const log of page.page) {
      if ((await ctx.db.get(log.groupId)) !== null) continue;
      orphaned += 1;
      const existing = await ctx.db
        .query("groupDeletionAuditMigrationRecords")
        .withIndex("by_legacy_audit_id", (q) => q.eq("legacyAuditId", log._id.toString()))
        .unique();
      if (existing) {
        alreadyProcessed += 1;
        continue;
      }
      if (parseDeletedCounts(log.afterValue).status === "migrated") convertible += 1;
      else skipped += 1;
    }
    return {
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
      orphaned,
      convertible,
      skipped,
      alreadyProcessed,
    };
  },
});

export const executeBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const page = await loadOrphanedPage(ctx, args.cursor ?? null);
    let migrated = 0;
    let skipped = 0;
    let alreadyProcessed = 0;
    for (const log of page.page) {
      if ((await ctx.db.get(log.groupId)) !== null) continue;
      const legacyAuditId = log._id.toString();
      const existing = await ctx.db
        .query("groupDeletionAuditMigrationRecords")
        .withIndex("by_legacy_audit_id", (q) => q.eq("legacyAuditId", legacyAuditId))
        .unique();
      if (existing) {
        alreadyProcessed += 1;
        if (existing.status === "migrated") await ctx.db.delete(log._id);
        continue;
      }
      const parsed = parseDeletedCounts(log.afterValue);
      const now = Date.now();
      if (parsed.status === "skipped") {
        await ctx.db.insert("groupDeletionAuditMigrationRecords", {
          recordKind: "legacy_audit",
          legacyAuditId,
          actorUserIdSnapshot: log.actorUserId,
          targetGroupIdSnapshot: log.groupId.toString(),
          ...(log.targetLabel ? { targetGroupNameSnapshot: log.targetLabel } : {}),
          deletedCounts: emptyDeletedCounts(),
          sourceCreatedAt: log.createdAt,
          status: "skipped",
          skipReason: parsed.reason,
          createdAt: now,
          updatedAt: now,
        });
        skipped += 1;
        continue;
      }
      await ctx.db.insert("groupDeletionAuditMigrationRecords", {
        recordKind: "legacy_audit",
        legacyAuditId,
        actorUserIdSnapshot: log.actorUserId,
        targetGroupIdSnapshot: log.groupId.toString(),
        ...(log.targetLabel ? { targetGroupNameSnapshot: log.targetLabel } : {}),
        deletedCounts: parsed.counts,
        sourceCreatedAt: log.createdAt,
        status: "migrated",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.delete(log._id);
      migrated += 1;
    }
    const result = {
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
      migrated,
      skipped,
      alreadyProcessed,
    };
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.legacyGroupDeletionAuditMigration.executeBatch, {
        cursor: page.continueCursor,
      });
    }
    return result;
  },
});

export const verify = internalQuery({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    remainingOrphaned: v.number(),
    unmigrated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await loadOrphanedPage(ctx, args.cursor ?? null);
    let remainingOrphaned = 0;
    let unmigrated = 0;
    let skipped = 0;
    for (const log of page.page) {
      if ((await ctx.db.get(log.groupId)) !== null) continue;
      remainingOrphaned += 1;
      const record = await ctx.db
        .query("groupDeletionAuditMigrationRecords")
        .withIndex("by_legacy_audit_id", (q) => q.eq("legacyAuditId", log._id.toString()))
        .unique();
      if (!record) unmigrated += 1;
      else if (record.status === "skipped") skipped += 1;
    }
    return {
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
      remainingOrphaned,
      unmigrated,
      skipped,
    };
  },
});

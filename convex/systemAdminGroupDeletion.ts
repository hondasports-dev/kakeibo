import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSystemAdmin } from "./systemAdmins";
import {
  groupDeletionCountsValidator,
  groupDeletionSourceValidator,
  groupDeletionStageValidator,
  groupDeletionStatusValidator,
} from "./groups/lib/groupDeletionJobModel";
import { resumeGroupDeletionHandler } from "./groups/groupDeletion";

const statusFilterValidator = v.optional(groupDeletionStatusValidator);
const sanitizedErrorCategories = new Set([
  "batch_processing_failed",
  "identity_deletion_failed",
  "finalization_failed",
  "unknown",
]);

const groupDeletionItemValidator = v.object({
  jobId: v.id("groupDeletionJobs"),
  targetGroupIdSnapshot: v.string(),
  targetGroupNameSnapshot: v.string(),
  source: groupDeletionSourceValidator,
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
});

function sanitizeErrorCategory(category: string | undefined) {
  if (category === undefined) return undefined;
  return sanitizedErrorCategories.has(category) ? category : "unknown";
}

export const listGroupDeletionJobs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: statusFilterValidator,
  },
  returns: v.object({
    ...paginationResultValidator(groupDeletionItemValidator).fields,
    environment: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const configuredEnvironment = process.env.APP_ENV;
    const environment =
      configuredEnvironment === "production" || configuredEnvironment === "preview"
        ? configuredEnvironment
        : "development";
    const jobs = args.status
      ? await ctx.db
          .query("groupDeletionJobs")
          .withIndex("by_status_and_updated_at", (q) => q.eq("status", args.status!))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("groupDeletionJobs")
          .withIndex("by_updated_at")
          .order("desc")
          .paginate(args.paginationOpts);

    return {
      environment,
      ...jobs,
      page: jobs.page.map((job) => ({
        jobId: job._id,
        targetGroupIdSnapshot: job.targetGroupIdSnapshot,
        targetGroupNameSnapshot: job.targetGroupNameSnapshot,
        source: job.source,
        status: job.status,
        stage: job.stage,
        isActive: job.isActive,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        nextRetryAt: job.nextRetryAt,
        lastErrorCategory: sanitizeErrorCategory(job.lastErrorCategory),
        deletedCounts: job.deletedCounts,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      })),
    };
  },
});

export const resumeGroupDeletion = mutation({
  args: { jobId: v.id("groupDeletionJobs"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length < 1 || reason.length > 500) {
      throw new ConvexError("理由は1〜500文字で入力してください");
    }
    const job = await ctx.db.get(args.jobId);
    if (job === null) throw new ConvexError("削除ジョブが見つかりません");
    await resumeGroupDeletionHandler(ctx, { jobId: args.jobId });
    await ctx.db.insert("systemAdminAuditLogs", {
      action: "system_admin_group_deletion_resumed",
      actorType: "system_admin",
      actorUserId: actor.user._id,
      targetKind: "group",
      targetId: job.targetGroupIdSnapshot,
      targetDisplayNameSnapshot: job.targetGroupNameSnapshot,
      reason,
      result: "success",
      createdAt: Date.now(),
    });
    return null;
  },
});

export type SystemAdminGroupDeletionJobId = Id<"groupDeletionJobs">;

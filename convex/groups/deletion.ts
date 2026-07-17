import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { GROUP_ADMIN_ERRORS } from "./adminGuards";
import { countGroupDeletionImpact } from "./lib/groupDeletionImpact";
import { assertGroupNotDeleted } from "./lib/groupLifecycle";
import type { GroupDoc } from "./lib/groupTypes";
import { normalizeGroupName } from "./lib/groupName";
import { requireGroupOwner } from "./membership";
import { groupDeletionPreviewValidator } from "./validators";
import { resumeGroupDeletionHandler, startGroupDeletionHandler } from "./groupDeletion";
import { requireAuthenticatedUserId } from "../users/auth";
import { groupDeletionStatusValidator } from "./lib/groupDeletionJobModel";

export async function getGroupDeletionPreviewHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupOwner(ctx);
  const group = (await ctx.db.get(groupId)) as GroupDoc | null;
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }
  assertGroupNotDeleted(group);

  const counts = await countGroupDeletionImpact(ctx, groupId);

  return {
    groupName: group.name,
    ...counts,
  };
}

export async function requestGroupDeletionHandler(
  ctx: MutationCtx,
  args: { confirmationGroupName: string },
) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  const group = (await ctx.db.get(groupId)) as GroupDoc | null;
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }
  assertGroupNotDeleted(group);

  const confirmationGroupName = normalizeGroupName(args.confirmationGroupName);
  if (confirmationGroupName !== group.name) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_NAME_MISMATCH);
  }

  const jobId = await startGroupDeletionHandler(ctx, {
    groupId,
    source: "owner",
    actorUserIdSnapshot: userId,
  });
  const requester = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
    .unique();
  if (requester?.activeGroupId === groupId) {
    await ctx.db.patch(requester._id, { activeGroupId: undefined, updatedAt: Date.now() });
  }
  return jobId;
}

/** @deprecated owner UIはrequestGroupDeletionを使用する。旧handler testの移行期間だけ残す。 */
export const deleteGroupHandler = requestGroupDeletionHandler;

export const getGroupDeletionPreview = query({
  args: {},
  returns: groupDeletionPreviewValidator,
  handler: getGroupDeletionPreviewHandler,
});

export const requestGroupDeletion = mutation({
  args: { confirmationGroupName: v.string() },
  returns: v.id("groupDeletionJobs"),
  handler: requestGroupDeletionHandler,
});

const publicGroupDeletionStatusValidator = v.object({
  jobId: v.id("groupDeletionJobs"),
  groupName: v.string(),
  status: groupDeletionStatusValidator,
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

export const getGroupDeletionStatus = query({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.union(v.null(), publicGroupDeletionStatusValidator),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const job = await ctx.db.get(args.jobId);
    if (job === null || job.actorUserIdSnapshot !== userId || job.source !== "owner") return null;
    return {
      jobId: job._id,
      groupName: job.targetGroupNameSnapshot,
      status: job.status,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  },
});

export const resumeGroupDeletion = mutation({
  args: { jobId: v.id("groupDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const job = await ctx.db.get(args.jobId);
    if (job === null || job.actorUserIdSnapshot !== userId || job.source !== "owner") {
      throw new ConvexError("削除ジョブが見つかりません");
    }
    return await resumeGroupDeletionHandler(ctx, args);
  },
});

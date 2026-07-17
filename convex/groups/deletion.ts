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
import { startGroupDeletionHandler } from "./groupDeletion";

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

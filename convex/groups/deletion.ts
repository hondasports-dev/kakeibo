import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { GROUP_ADMIN_ERRORS } from "./adminGuards";
import { deleteAllGroupScopedData } from "./lib/deleteGroupPhysically";
import { countGroupDeletionImpact } from "./lib/groupDeletionImpact";
import { assertGroupNotDeleted, isGroupDeleted } from "./lib/groupLifecycle";
import type { GroupDoc } from "./lib/groupTypes";
import { normalizeGroupName } from "./lib/groupName";
import { readQueryDoc } from "./lib/groupQueryHelpers";
import { recordManagementAuditLog } from "./lib/managementAuditLog";
import { findNextActiveGroupIdForUser, requireGroupOwner } from "./membership";
import { groupDeletionPreviewValidator } from "./validators";

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

export async function deleteGroupHandler(
  ctx: MutationCtx,
  args: { confirmationGroupName: string },
) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  const group = (await ctx.db.get(groupId)) as GroupDoc | null;
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }
  if (isGroupDeleted(group)) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_ALREADY_DELETED);
  }

  const confirmationGroupName = normalizeGroupName(args.confirmationGroupName);
  if (confirmationGroupName !== group.name) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_NAME_MISMATCH);
  }

  const affectedCounts = await countGroupDeletionImpact(ctx, groupId);
  const now = Date.now();
  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
    .collect();

  for (const member of members) {
    const memberUser = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", member.userId)),
    );
    if (memberUser?.activeGroupId !== groupId) {
      continue;
    }

    const nextActiveGroupId = await findNextActiveGroupIdForUser(ctx, member.userId, groupId);
    await ctx.db.patch(memberUser._id, {
      activeGroupId: nextActiveGroupId,
      updatedAt: now,
    });
  }

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "group_deleted",
    targetKind: "group",
    targetId: groupId,
    targetLabel: group.name,
    afterValue: JSON.stringify({
      deletionMode: "immediate",
      affectedCounts,
    }),
  });

  await deleteAllGroupScopedData(ctx, groupId);
}

export const getGroupDeletionPreview = query({
  args: {},
  returns: groupDeletionPreviewValidator,
  handler: getGroupDeletionPreviewHandler,
});

export const deleteGroup = mutation({
  args: { confirmationGroupName: v.string() },
  returns: v.null(),
  handler: deleteGroupHandler,
});

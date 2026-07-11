import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assertGroupNotDeleted } from "./lib/groupLifecycle";
import { normalizeGroupName } from "./lib/groupName";
import { recordManagementAuditLog } from "./lib/managementAuditLog";
import { readQueryDoc } from "./lib/groupQueryHelpers";
import { requireAuthenticatedUserId } from "../users/auth";
import { requireGroupOwner } from "./membership";
import { assertAccountDeletionNotInProgress } from "../accountDeletion";

export async function createGroupHandler(ctx: MutationCtx, args: { name: string }) {
  const userId = await requireAuthenticatedUserId(ctx);
  await assertAccountDeletionNotInProgress(ctx, userId);
  const name = normalizeGroupName(args.name);

  const now = Date.now();
  const groupId = await ctx.db.insert("groups", {
    name,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("groupMembers", {
    groupId,
    userId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  if (user !== null) {
    await ctx.db.patch(user._id, { activeGroupId: groupId, updatedAt: now });
  }

  return groupId;
}

/**
 * active group の名前を更新する（オーナーのみ）。
 * @returns 更新したグループ ID
 */
export async function updateGroupNameHandler(ctx: MutationCtx, args: { name: string }) {
  const { groupId, userId } = await requireGroupOwner(ctx);
  const name = normalizeGroupName(args.name);

  const group = await ctx.db.get(groupId);
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }
  assertGroupNotDeleted(group);

  const previousName = group.name;
  if (previousName === name) {
    return groupId;
  }

  await ctx.db.patch(groupId, {
    name,
    updatedAt: Date.now(),
  });

  await recordManagementAuditLog(ctx, {
    groupId,
    actorUserId: userId,
    action: "group_name_changed",
    targetKind: "group",
    targetId: groupId,
    targetLabel: previousName,
    beforeValue: previousName,
    afterValue: name,
  });

  return groupId;
}

export async function setActiveGroupHandler(ctx: MutationCtx, args: { groupId: Id<"groups"> }) {
  const userId = await requireAuthenticatedUserId(ctx);
  const membership = await readQueryDoc(
    ctx.db
      .query("groupMembers")
      .withIndex("by_group_id_and_user_id", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      ),
  );

  if (membership === null) {
    throw new ConvexError("指定されたグループに所属していません");
  }

  const group = await ctx.db.get(args.groupId);
  if (group === null) {
    throw new ConvexError("グループが見つかりません");
  }
  assertGroupNotDeleted(group);

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  if (user === null) {
    throw new ConvexError("User not found");
  }

  await ctx.db.patch(user._id, {
    activeGroupId: args.groupId,
    updatedAt: Date.now(),
  });

  return args.groupId;
}

export const createGroup = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: createGroupHandler,
});

export const updateGroupName = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: updateGroupNameHandler,
});

export const setActiveGroup = mutation({
  args: { groupId: v.id("groups") },
  returns: v.id("groups"),
  handler: setActiveGroupHandler,
});

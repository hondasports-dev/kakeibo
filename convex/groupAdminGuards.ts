import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

export type GroupAdminRole = "owner" | "member";

export const GROUP_ADMIN_ERRORS = {
  OWNER_ONLY: "グループオーナーのみ実行できます",
  NOT_ACTIVE_GROUP: "現在選択中のグループでのみ実行できます",
  SELF_OPERATION_FORBIDDEN: "自分自身に対してこの操作はできません",
  OWNER_MEMBER_NOT_REMOVABLE: "オーナーはグループから外せません",
  LAST_OWNER_PROTECTED: "最後のオーナーは変更できません",
  TRANSFER_TARGET_MUST_BE_MEMBER: "譲渡先はメンバーロールのユーザーに限定されます",
  GROUP_ARCHIVED: "アーカイブ済みのグループにはアクセスできません",
  GROUP_ALREADY_ARCHIVED: "このグループはすでにアーカイブされています",
} as const;

export function assertGroupOwnerRole(role: GroupAdminRole): void {
  if (role !== "owner") {
    throw new ConvexError(GROUP_ADMIN_ERRORS.OWNER_ONLY);
  }
}

export function assertActiveGroupScope(
  activeGroupId: Id<"groups">,
  targetGroupId: Id<"groups">,
): void {
  if (activeGroupId !== targetGroupId) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.NOT_ACTIVE_GROUP);
  }
}

export function assertNotSelfOperator(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.SELF_OPERATION_FORBIDDEN);
  }
}

export function assertRemovableGroupMemberRole(role: GroupAdminRole): void {
  if (role === "owner") {
    throw new ConvexError(GROUP_ADMIN_ERRORS.OWNER_MEMBER_NOT_REMOVABLE);
  }
}

export async function countGroupOwners(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
): Promise<number> {
  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
    .collect();

  return members.filter((member) => member.role === "owner").length;
}

export async function assertGroupHasMinimumOwners(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">,
  minimum: number,
): Promise<void> {
  const ownerCount = await countGroupOwners(ctx, groupId);
  if (ownerCount < minimum) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.LAST_OWNER_PROTECTED);
  }
}

export type GroupAdminRole = "owner" | "member";

export type GroupAdminErrorKey =
  | "owner_only"
  | "not_active_group"
  | "self_operation_forbidden"
  | "owner_member_not_removable";

export function validateGroupOwnerRole(
  role: GroupAdminRole,
): { success: true } | { success: false; error: GroupAdminErrorKey } {
  if (role !== "owner") {
    return { success: false, error: "owner_only" };
  }
  return { success: true };
}

export function validateActiveGroupScope(
  activeGroupId: string,
  targetGroupId: string,
): { success: true } | { success: false; error: GroupAdminErrorKey } {
  if (activeGroupId !== targetGroupId) {
    return { success: false, error: "not_active_group" };
  }
  return { success: true };
}

export function validateNotSelfOperator(
  actorUserId: string,
  targetUserId: string,
): { success: true } | { success: false; error: GroupAdminErrorKey } {
  if (actorUserId === targetUserId) {
    return { success: false, error: "self_operation_forbidden" };
  }
  return { success: true };
}

export function validateRemovableGroupMemberRole(
  role: GroupAdminRole,
): { success: true } | { success: false; error: GroupAdminErrorKey } {
  if (role === "owner") {
    return { success: false, error: "owner_member_not_removable" };
  }
  return { success: true };
}

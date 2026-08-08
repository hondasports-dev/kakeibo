export type GroupLifecycleStatus = "active" | "deleting" | "deleted" | "archived";

export type GroupWithLifecycleStatus = {
  status?: GroupLifecycleStatus;
};

export function isGroupDeleted(group: GroupWithLifecycleStatus): boolean {
  return group.status === "deleting" || group.status === "deleted" || group.status === "archived";
}

export type GroupNotDeletedResult = { success: true } | { success: false; error: "group_deleted" };

export function assertGroupNotDeleted(group: GroupWithLifecycleStatus): GroupNotDeletedResult {
  if (isGroupDeleted(group)) {
    return { success: false, error: "group_deleted" };
  }
  return { success: true };
}

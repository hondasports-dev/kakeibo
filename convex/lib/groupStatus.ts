import { ConvexError } from "convex/values";
import { GROUP_ADMIN_ERRORS } from "../groupAdminGuards";

export type GroupLifecycleStatus = "active" | "archived";

export type GroupWithLifecycleStatus = {
  status?: GroupLifecycleStatus;
};

export function isGroupArchived(group: GroupWithLifecycleStatus): boolean {
  return group.status === "archived";
}

export function assertGroupNotArchived(group: GroupWithLifecycleStatus): void {
  if (isGroupArchived(group)) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_ARCHIVED);
  }
}

import { ConvexError } from "convex/values";
import { GROUP_ADMIN_ERRORS } from "../adminGuards";

export type GroupLifecycleStatus = "active" | "deleting" | "deleted" | "archived";

export type GroupWithLifecycleStatus = {
  status?: GroupLifecycleStatus;
};

export function isGroupDeleted(group: GroupWithLifecycleStatus): boolean {
  return (
    group.status === "deleting" || group.status === "deleted" || group.status === "archived"
  );
}

export function assertGroupNotDeleted(group: GroupWithLifecycleStatus): void {
  if (isGroupDeleted(group)) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_DELETED);
  }
}

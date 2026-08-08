import { ConvexError } from "convex/values";
import {
  assertGroupNotDeleted as assertGroupNotDeletedDomain,
  type GroupLifecycleStatus,
} from "../../../lib/domain/groups/lifecycle";
import { GROUP_ADMIN_ERRORS } from "../adminGuards";

export {
  isGroupDeleted,
  type GroupLifecycleStatus,
  type GroupWithLifecycleStatus,
} from "../../../lib/domain/groups/lifecycle";

export function assertGroupNotDeleted(group: { status?: GroupLifecycleStatus }): void {
  const result = assertGroupNotDeletedDomain(group);
  if (!result.success) {
    throw new ConvexError(GROUP_ADMIN_ERRORS.GROUP_DELETED);
  }
}

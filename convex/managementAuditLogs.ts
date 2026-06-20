import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  MANAGEMENT_AUDIT_ACTION_LABELS,
  managementAuditLogListItemValidator,
} from "./lib/managementAuditLogModel";
import { requireGroupOwner } from "./groups";

export const MANAGEMENT_AUDIT_LOG_LIST_LIMIT = 50;

async function readQueryDoc<T>(queryHandle: {
  unique: () => Promise<T | null>;
}): Promise<T | null> {
  return await queryHandle.unique();
}

export async function listManagementAuditLogsHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupOwner(ctx);

  const logs = await ctx.db
    .query("managementAuditLogs")
    .withIndex("by_group_id_and_created_at", (q) => q.eq("groupId", groupId))
    .order("desc")
    .take(MANAGEMENT_AUDIT_LOG_LIST_LIMIT);

  return await Promise.all(
    logs.map(async (log) => {
      const actor = await readQueryDoc(
        ctx.db
          .query("users")
          .withIndex("by_token_identifier", (q) => q.eq("userId", log.actorUserId)),
      );

      return {
        _id: log._id,
        action: log.action,
        actionLabel: MANAGEMENT_AUDIT_ACTION_LABELS[log.action],
        actorDisplayName: actor?.displayName ?? "ユーザー",
        targetLabel: log.targetLabel ?? null,
        beforeValue: log.beforeValue ?? null,
        afterValue: log.afterValue ?? null,
        createdAt: log.createdAt,
      };
    }),
  );
}

export const listManagementAuditLogs = query({
  args: {},
  returns: v.array(managementAuditLogListItemValidator),
  handler: listManagementAuditLogsHandler,
});

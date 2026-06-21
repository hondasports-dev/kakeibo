import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  type ManagementAuditAction,
  type ManagementAuditTargetKind,
} from "./managementAuditLogModel";

export type RecordManagementAuditLogArgs = {
  groupId: Id<"groups">;
  actorUserId: string;
  action: ManagementAuditAction;
  targetKind: ManagementAuditTargetKind;
  targetId?: string;
  targetLabel?: string;
  beforeValue?: string;
  afterValue?: string;
};

export async function recordManagementAuditLog(
  ctx: MutationCtx,
  args: RecordManagementAuditLogArgs,
): Promise<Id<"managementAuditLogs">> {
  const now = Date.now();
  return await ctx.db.insert("managementAuditLogs", {
    groupId: args.groupId,
    actorUserId: args.actorUserId,
    action: args.action,
    targetKind: args.targetKind,
    targetId: args.targetId,
    targetLabel: args.targetLabel,
    beforeValue: args.beforeValue,
    afterValue: args.afterValue,
    createdAt: now,
  });
}

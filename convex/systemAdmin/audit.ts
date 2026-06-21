import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireSystemAdmin } from "./auth";
import {
  systemAdminAuditActionValidator,
  systemAdminAuditTargetKindValidator,
  systemAdminSearchQueryTypeValidator,
} from "./model";

export const recordSystemAdminAuditLog = internalMutation({
  args: {
    action: systemAdminAuditActionValidator,
    targetKind: systemAdminAuditTargetKindValidator,
    targetId: v.optional(v.string()),
    queryType: v.optional(systemAdminSearchQueryTypeValidator),
    queryHash: v.optional(v.string()),
    resultCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireSystemAdmin(ctx);
    await ctx.db.insert("systemAdminAuditLogs", {
      action: args.action,
      actorType: "system_admin",
      actorUserId: user._id,
      targetKind: args.targetKind,
      targetId: args.targetId,
      queryType: args.queryType,
      queryHash: args.queryHash,
      resultCount: args.resultCount,
      createdAt: Date.now(),
    });
    return null;
  },
});

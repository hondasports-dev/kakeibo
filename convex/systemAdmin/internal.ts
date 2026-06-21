import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { systemAdminEnvironmentValidator } from "./validators";

const MAX_REASON_LENGTH = 500;

export const bootstrapSystemAdmin = internalMutation({
  args: {
    targetUserId: v.id("users"),
    reason: v.string(),
    expectedEnvironment: systemAdminEnvironmentValidator,
  },
  returns: v.id("systemAdmins"),
  handler: async (ctx, args) => {
    if (process.env.APP_ENV !== args.expectedEnvironment) {
      throw new ConvexError("対象環境とAPP_ENVが一致しません");
    }
    const reason = args.reason.trim();
    if (reason.length === 0 || reason.length > MAX_REASON_LENGTH) {
      throw new ConvexError("理由は1〜500文字で入力してください");
    }
    const targetUser = await ctx.db.get(args.targetUserId);
    if (targetUser === null) {
      throw new ConvexError("対象ユーザーが見つかりません");
    }
    const activeAdmins = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    if (activeAdmins.length > 0) {
      throw new ConvexError("初期管理者は登録済みです");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
      .unique();
    let systemAdminId;
    if (existing === null) {
      systemAdminId = await ctx.db.insert("systemAdmins", {
        userId: args.targetUserId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        grantedAt: now,
        grantReason: reason,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status: "active",
        updatedAt: now,
        grantedAt: now,
        grantedByUserId: undefined,
        grantReason: reason,
        revokedAt: undefined,
        revokedByUserId: undefined,
        revokeReason: undefined,
      });
      systemAdminId = existing._id;
    }

    await ctx.db.insert("systemAdminAuditLogs", {
      action: "system_admin_bootstrapped",
      actorType: "system",
      targetKind: "system_admin",
      targetUserId: args.targetUserId,
      targetId: args.targetUserId,
      reason,
      previousStatus: existing?.status,
      newStatus: "active",
      createdAt: now,
    });
    return systemAdminId;
  },
});

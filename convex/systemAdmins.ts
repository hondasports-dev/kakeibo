import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const REASON_MAX_LENGTH = 500;
const ENVIRONMENTS = ["development", "preview", "production"] as const;
type AppEnvironment = (typeof ENVIRONMENTS)[number];

type DbCtx = Pick<QueryCtx, "db" | "auth"> | Pick<MutationCtx, "db" | "auth">;

function normalizeReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > REASON_MAX_LENGTH) {
    throw new ConvexError("理由は1〜500文字で入力してください");
  }
  return normalized;
}

function getAppEnvironment(expected?: string): AppEnvironment {
  const actual = process.env.APP_ENV;
  if (!expected) {
    return ENVIRONMENTS.includes(actual as AppEnvironment)
      ? (actual as AppEnvironment)
      : "development";
  }
  if (!ENVIRONMENTS.includes(actual as AppEnvironment) || actual !== expected) {
    throw new ConvexError("対象環境が一致しません");
  }
  return actual as AppEnvironment;
}

async function findUserByTokenIdentifier(ctx: DbCtx, tokenIdentifier: string) {
  return ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", tokenIdentifier))
    .unique();
}

export async function requireSystemAdmin(ctx: DbCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("システム管理者権限が必要です");
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!user) throw new ConvexError("システム管理者権限が必要です");
  let admin: Doc<"systemAdmins"> | null;
  try {
    admin = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
  } catch {
    throw new ConvexError("システム管理者権限が必要です");
  }
  if (!admin || admin.status !== "active") {
    throw new ConvexError("システム管理者権限が必要です");
  }
  return { identity, user, admin };
}

async function insertNotifications(
  ctx: MutationCtx,
  action: Doc<"systemAdminNotifications">["action"],
  targetUserId: Id<"users">,
  auditId: Id<"systemAdminAuditLogs">,
  environment: AppEnvironment,
) {
  const recipients = new Set<Id<"users">>([targetUserId]);
  let cursor: string | null = null;
  while (true) {
    const page = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .paginate({ cursor, numItems: 100 });
    for (const admin of page.page) recipients.add(admin.userId);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  const payloadJson = JSON.stringify({ action, targetUserId, environment });
  const now = Date.now();
  for (const recipientUserId of recipients) {
    const dedupeKey = `${auditId}:${recipientUserId}`;
    const existing = await ctx.db
      .query("systemAdminNotifications")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
      .unique();
    if (existing) continue;
    await ctx.db.insert("systemAdminNotifications", {
      action,
      recipientUserId,
      targetUserId,
      dedupeKey,
      payloadJson,
      createdAt: now,
    });
  }
}

async function createAudit(
  ctx: MutationCtx,
  args: {
    action: Doc<"systemAdminAuditLogs">["action"];
    actorType: Doc<"systemAdminAuditLogs">["actorType"];
    actorUserId?: Id<"users">;
    targetUserId: Id<"users">;
    targetDisplayNameSnapshot: string;
    reason: string;
    previousStatus?: Doc<"systemAdminAuditLogs">["previousStatus"];
    newStatus: Doc<"systemAdminAuditLogs">["newStatus"];
  },
) {
  return ctx.db.insert("systemAdminAuditLogs", {
    ...args,
    targetKind: "system_admin",
    createdAt: Date.now(),
  });
}

export const getMySystemAdminContext = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const environment = getAppEnvironment();
    if (!identity) return { status: "none" as const, environment };
    const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) return { status: "none" as const, environment };
    let admin: Doc<"systemAdmins"> | null = null;
    try {
      admin = await ctx.db
        .query("systemAdmins")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();
    } catch {
      return { status: "none" as const, environment };
    }
    return { status: admin?.status ?? "none", environment };
  },
});

export const listSystemAdmins = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
  },
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const page = args.status
      ? await ctx.db
          .query("systemAdmins")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db.query("systemAdmins").order("desc").paginate(args.paginationOpts);
    const users = await Promise.all(page.page.map((admin) => ctx.db.get(admin.userId)));
    return {
      ...page,
      page: page.page.map((admin, index) => ({
        id: admin._id,
        userId: admin.userId,
        status: admin.status,
        displayName: users[index]?.displayName ?? "ユーザー",
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
        grantedAt: admin.grantedAt,
        revokedAt: admin.revokedAt,
      })),
    };
  },
});

export const listSystemAdminAuditLogs = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const page = await ctx.db
      .query("systemAdminAuditLogs")
      .withIndex("by_created_at")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.map((log) => ({
        id: log._id,
        action: log.action,
        actorType: log.actorType,
        targetUserId: log.targetUserId,
        targetDisplayName: log.targetDisplayNameSnapshot,
        reason: log.reason,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        createdAt: log.createdAt,
      })),
    };
  },
});

export const grantSystemAdmin = mutation({
  args: { targetUserId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    if (actor.user._id === args.targetUserId) throw new ConvexError("自分自身は操作できません");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    let existing: Doc<"systemAdmins"> | null;
    try {
      existing = await ctx.db
        .query("systemAdmins")
        .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
        .unique();
    } catch {
      throw new ConvexError("管理者レコードが不正です");
    }
    if (existing?.status === "active") throw new ConvexError("既に管理者です");
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("systemAdmins", {
        userId: args.targetUserId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        grantedAt: now,
        grantedByUserId: actor.user._id,
        grantReason: reason,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status: "active",
        updatedAt: now,
        grantedAt: now,
        grantedByUserId: actor.user._id,
        grantReason: reason,
        revokedAt: undefined,
        revokedByUserId: undefined,
        revokeReason: undefined,
      });
    }
    const auditId = await createAudit(ctx, {
      action: "system_admin_granted",
      actorType: "system_admin",
      actorUserId: actor.user._id,
      targetUserId: args.targetUserId,
      targetDisplayNameSnapshot: target.displayName,
      reason,
      previousStatus: existing?.status,
      newStatus: "active",
    });
    await insertNotifications(
      ctx,
      "system_admin_granted",
      args.targetUserId,
      auditId,
      getAppEnvironment(),
    );
    return { status: "active" as const, regranted: existing?.status === "revoked" };
  },
});

export const revokeSystemAdmin = mutation({
  args: { targetUserId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const reason = normalizeReason(args.reason);
    if (actor.user._id === args.targetUserId) throw new ConvexError("自分自身は操作できません");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    const targetAdmin = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
      .unique();
    if (!targetAdmin || targetAdmin.status !== "active")
      throw new ConvexError("対象はactive管理者ではありません");
    const activeAdmins = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(2);
    if (activeAdmins.length < 2) throw new ConvexError("最後の管理者は剥奪できません");
    const now = Date.now();
    await ctx.db.patch(targetAdmin._id, {
      status: "revoked",
      updatedAt: now,
      revokedAt: now,
      revokedByUserId: actor.user._id,
      revokeReason: reason,
    });
    const auditId = await createAudit(ctx, {
      action: "system_admin_revoked",
      actorType: "system_admin",
      actorUserId: actor.user._id,
      targetUserId: args.targetUserId,
      targetDisplayNameSnapshot: target.displayName,
      reason,
      previousStatus: "active",
      newStatus: "revoked",
    });
    await insertNotifications(
      ctx,
      "system_admin_revoked",
      args.targetUserId,
      auditId,
      getAppEnvironment(),
    );
    return { status: "revoked" as const };
  },
});

export const bootstrapSystemAdmin = internalMutation({
  args: {
    targetUserId: v.id("users"),
    reason: v.string(),
    expectedEnvironment: v.string(),
  },
  handler: async (ctx, args) => {
    const environment = getAppEnvironment(args.expectedEnvironment);
    const reason = normalizeReason(args.reason);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    const active = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    if (active.length > 0) throw new ConvexError("初回管理者は既に存在します");
    const existing = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
      .unique();
    if (existing) throw new ConvexError("対象ユーザーの管理者履歴が既に存在します");
    const now = Date.now();
    await ctx.db.insert("systemAdmins", {
      userId: args.targetUserId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      grantedAt: now,
      grantReason: reason,
    });
    const auditId = await createAudit(ctx, {
      action: "system_admin_bootstrapped",
      actorType: "system",
      targetUserId: args.targetUserId,
      targetDisplayNameSnapshot: target.displayName,
      reason,
      newStatus: "active",
    });
    await insertNotifications(
      ctx,
      "system_admin_bootstrapped",
      args.targetUserId,
      auditId,
      environment,
    );
    return { status: "active" as const };
  },
});

export const recoverSystemAdmin = internalMutation({
  args: {
    targetUserId: v.id("users"),
    reason: v.string(),
    expectedEnvironment: v.string(),
  },
  handler: async (ctx, args) => {
    const environment = getAppEnvironment(args.expectedEnvironment);
    const reason = normalizeReason(args.reason);
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError("対象ユーザーが存在しません");
    const active = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    if (active.length > 0) throw new ConvexError("active管理者が存在するため復旧できません");
    const existing = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
      .unique();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("systemAdmins", {
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
        grantReason: reason,
        revokedAt: undefined,
        revokedByUserId: undefined,
        revokeReason: undefined,
      });
    }
    const auditId = await createAudit(ctx, {
      action: "system_admin_recovered",
      actorType: "system",
      targetUserId: args.targetUserId,
      targetDisplayNameSnapshot: target.displayName,
      reason,
      previousStatus: existing?.status,
      newStatus: "active",
    });
    await insertNotifications(
      ctx,
      "system_admin_recovered",
      args.targetUserId,
      auditId,
      environment,
    );
    return { status: "active" as const };
  },
});

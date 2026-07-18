import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const REASON_MAX_LENGTH = 500;
const ENVIRONMENTS = ["development", "preview", "production"] as const;
type AppEnvironment = (typeof ENVIRONMENTS)[number];

const systemAdminStatusValidator = v.union(v.literal("active"), v.literal("revoked"));
const systemAdminAuditActionValidator = v.union(
  v.literal("system_admin_bootstrapped"),
  v.literal("system_admin_granted"),
  v.literal("system_admin_revoked"),
  v.literal("system_admin_recovered"),
  v.literal("system_admin_user_searched"),
  v.literal("system_admin_group_searched"),
  v.literal("system_admin_user_viewed"),
  v.literal("system_admin_group_viewed"),
  v.literal("system_admin_membership_added"),
  v.literal("system_admin_membership_removed"),
  v.literal("system_admin_membership_transferred"),
  v.literal("system_admin_active_group_set"),
  v.literal("system_admin_active_group_cleared"),
  v.literal("system_admin_group_deletion_resumed"),
  v.literal("system_admin_ownerless_group_recovered"),
  v.literal("system_admin_group_role_changed"),
  v.literal("system_admin_group_owner_transferred"),
);
const systemAdminContextValidator = v.union(
  v.object({ status: v.literal("active"), environment: v.string(), userId: v.id("users") }),
  v.object({ status: v.literal("revoked"), environment: v.string() }),
  v.object({ status: v.literal("none"), environment: v.string() }),
);
const systemAdminListItemValidator = v.object({
  id: v.id("systemAdmins"),
  targetUserId: v.id("users"),
  status: systemAdminStatusValidator,
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  grantedAt: v.number(),
  revokedAt: v.optional(v.number()),
  isSelf: v.boolean(),
});
const systemAdminAuditItemValidator = v.object({
  id: v.id("systemAdminAuditLogs"),
  action: systemAdminAuditActionValidator,
  actorType: v.union(v.literal("system"), v.literal("system_admin")),
  actorUserId: v.optional(v.id("users")),
  actorDisplayName: v.union(v.string(), v.null()),
  targetUserId: v.optional(v.id("users")),
  targetId: v.optional(v.string()),
  targetDisplayName: v.optional(v.string()),
  sourceUserId: v.optional(v.id("users")),
  sourceUserDisplayName: v.optional(v.string()),
  reason: v.optional(v.string()),
  queryHash: v.optional(v.string()),
  resultCount: v.optional(v.number()),
  result: v.union(v.literal("success"), v.literal("denied")),
  previousStatus: v.optional(systemAdminStatusValidator),
  newStatus: v.optional(systemAdminStatusValidator),
  sourceGroupId: v.optional(v.id("groups")),
  sourceGroupNameSnapshot: v.optional(v.string()),
  targetGroupId: v.optional(v.id("groups")),
  targetGroupNameSnapshot: v.optional(v.string()),
  beforeMembershipStatus: v.optional(
    v.union(v.literal("none"), v.literal("member"), v.literal("owner")),
  ),
  afterMembershipStatus: v.optional(
    v.union(v.literal("none"), v.literal("member"), v.literal("owner")),
  ),
  beforeActiveGroupId: v.optional(v.id("groups")),
  afterActiveGroupId: v.optional(v.id("groups")),
  beforeOwnerCount: v.optional(v.number()),
  afterOwnerCount: v.optional(v.number()),
  createdAt: v.number(),
});

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
  returns: systemAdminContextValidator,
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
    if (admin?.status === "active") {
      return { status: "active" as const, environment, userId: user._id };
    }
    if (admin?.status === "revoked") {
      return { status: "revoked" as const, environment };
    }
    return { status: "none" as const, environment };
  },
});

export const listSystemAdmins = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
  },
  returns: v.object({
    ...paginationResultValidator(systemAdminListItemValidator).fields,
    hasAnotherActiveAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireSystemAdmin(ctx);
    const status = args.status ?? "active";
    const page = await ctx.db
      .query("systemAdmins")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .paginate(args.paginationOpts);
    const hasAnotherActiveAdmin =
      (
        await ctx.db
          .query("systemAdmins")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .take(2)
      ).length >= 2;
    const users = await Promise.all(page.page.map((admin) => ctx.db.get(admin.userId)));
    return {
      ...page,
      hasAnotherActiveAdmin,
      page: page.page.map((admin, index) => ({
        id: admin._id,
        targetUserId: admin.userId,
        status: admin.status,
        displayName: users[index]?.displayName ?? "ユーザー",
        email: users[index]?.email ?? null,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
        grantedAt: admin.grantedAt,
        revokedAt: admin.revokedAt,
        isSelf: admin.userId === actor.user._id,
      })),
    };
  },
});

export const listSystemAdminAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    action: v.optional(systemAdminAuditActionValidator),
    actorUserId: v.optional(v.id("users")),
    targetUserId: v.optional(v.id("users")),
  },
  returns: v.object({
    ...paginationResultValidator(systemAdminAuditItemValidator).fields,
  }),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const page =
      args.action && args.actorUserId && args.targetUserId
        ? await ctx.db
            .query("systemAdminAuditLogs")
            .withIndex("by_action_and_actor_user_id_and_target_user_id_and_created_at", (q) =>
              q
                .eq("action", args.action!)
                .eq("actorUserId", args.actorUserId!)
                .eq("targetUserId", args.targetUserId!)
                .gte("createdAt", from)
                .lte("createdAt", to),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : args.action && args.actorUserId
          ? await ctx.db
              .query("systemAdminAuditLogs")
              .withIndex("by_action_and_actor_user_id_and_created_at", (q) =>
                q
                  .eq("action", args.action!)
                  .eq("actorUserId", args.actorUserId!)
                  .gte("createdAt", from)
                  .lte("createdAt", to),
              )
              .order("desc")
              .paginate(args.paginationOpts)
          : args.action && args.targetUserId
            ? await ctx.db
                .query("systemAdminAuditLogs")
                .withIndex("by_action_and_target_user_id_and_created_at", (q) =>
                  q
                    .eq("action", args.action!)
                    .eq("targetUserId", args.targetUserId!)
                    .gte("createdAt", from)
                    .lte("createdAt", to),
                )
                .order("desc")
                .paginate(args.paginationOpts)
            : args.actorUserId && args.targetUserId
              ? await ctx.db
                  .query("systemAdminAuditLogs")
                  .withIndex("by_actor_user_id_and_target_user_id_and_created_at", (q) =>
                    q
                      .eq("actorUserId", args.actorUserId!)
                      .eq("targetUserId", args.targetUserId!)
                      .gte("createdAt", from)
                      .lte("createdAt", to),
                  )
                  .order("desc")
                  .paginate(args.paginationOpts)
              : args.action
                ? await ctx.db
                    .query("systemAdminAuditLogs")
                    .withIndex("by_action_and_created_at", (q) =>
                      q.eq("action", args.action!).gte("createdAt", from).lte("createdAt", to),
                    )
                    .order("desc")
                    .paginate(args.paginationOpts)
                : args.actorUserId
                  ? await ctx.db
                      .query("systemAdminAuditLogs")
                      .withIndex("by_actor_user_id_and_created_at", (q) =>
                        q
                          .eq("actorUserId", args.actorUserId!)
                          .gte("createdAt", from)
                          .lte("createdAt", to),
                      )
                      .order("desc")
                      .paginate(args.paginationOpts)
                  : args.targetUserId
                    ? await ctx.db
                        .query("systemAdminAuditLogs")
                        .withIndex("by_target_user_id_and_created_at", (q) =>
                          q
                            .eq("targetUserId", args.targetUserId!)
                            .gte("createdAt", from)
                            .lte("createdAt", to),
                        )
                        .order("desc")
                        .paginate(args.paginationOpts)
                    : await ctx.db
                        .query("systemAdminAuditLogs")
                        .withIndex("by_created_at", (q) =>
                          q.gte("createdAt", from).lte("createdAt", to),
                        )
                        .order("desc")
                        .paginate(args.paginationOpts);
    const actors = await Promise.all(
      page.page.map((log) => (log.actorUserId ? ctx.db.get(log.actorUserId) : null)),
    );
    return {
      ...page,
      page: page.page.map((log, index) => ({
        id: log._id,
        action: log.action,
        actorType: log.actorType,
        actorUserId: log.actorUserId,
        actorDisplayName: actors[index]?.displayName ?? null,
        targetUserId: log.targetUserId,
        targetId: log.targetId,
        targetDisplayName: log.targetDisplayNameSnapshot,
        sourceUserId: log.sourceUserId,
        sourceUserDisplayName: log.sourceUserDisplayNameSnapshot,
        reason: log.reason,
        queryHash: log.queryHash,
        resultCount: log.resultCount,
        result: log.result ?? "success",
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        sourceGroupId: log.sourceGroupId,
        sourceGroupNameSnapshot: log.sourceGroupNameSnapshot,
        targetGroupId: log.targetGroupId,
        targetGroupNameSnapshot: log.targetGroupNameSnapshot,
        beforeMembershipStatus: log.beforeMembershipStatus,
        afterMembershipStatus: log.afterMembershipStatus,
        beforeActiveGroupId: log.beforeActiveGroupId,
        afterActiveGroupId: log.afterActiveGroupId,
        beforeOwnerCount: log.beforeOwnerCount,
        afterOwnerCount: log.afterOwnerCount,
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

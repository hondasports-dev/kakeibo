import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalidJsonResponse, requireE2eSecret } from "./e2eAuth";

const prefixPattern = /^e2e-system-admin-504-[a-z0-9-]+$/;
const SEARCH_USER_COUNT = 25;
const SEARCH_GROUP_COUNT = 24;
const groupStatuses = ["active", "deleting", "deleted", "archived"] as const;

function assertFixtureEnvironment(prefix: string) {
  if (process.env.APP_ENV === "production")
    throw new ConvexError("E2E fixture is disabled in production");
  if (!prefixPattern.test(prefix)) throw new ConvexError("invalid fixture prefix");
}

async function deleteFixture(ctx: MutationCtx, prefix: string) {
  const fixture = await ctx.db
    .query("e2eSystemAdminSearchFixtures")
    .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
    .unique();
  if (!fixture) return;

  for (const userId of fixture.userIds) await ctx.db.delete(userId);
  for (const groupId of fixture.groupIds) await ctx.db.delete(groupId);

  const auditActions = ["system_admin_user_searched", "system_admin_group_searched"] as const;
  for (const action of auditActions) {
    const audits = await ctx.db
      .query("systemAdminAuditLogs")
      .withIndex("by_action_and_actor_user_id_and_created_at", (q) =>
        q.eq("action", action).eq("actorUserId", fixture.actorUserId),
      )
      .take(101);
    if (audits.length > 100) throw new ConvexError("E2E fixture has too many audit logs");
    for (const audit of audits) {
      if (audit.createdAt >= fixture.createdAt) await ctx.db.delete(audit._id);
    }
  }

  if (fixture.createdAdmin) {
    const admin = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", fixture.actorUserId))
      .unique();
    if (admin?.grantReason === `e2e:${prefix}`) await ctx.db.delete(admin._id);
  }

  await ctx.db.delete(fixture._id);
}

export const seedSystemAdminSearchFixture = internalMutation({
  args: { actorUserId: v.string(), prefix: v.string() },
  handler: async (ctx, args) => {
    assertFixtureEnvironment(args.prefix);
    await deleteFixture(ctx, args.prefix);

    const actor = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.actorUserId))
      .unique();
    if (!actor) throw new ConvexError("E2E actor user not found");

    const existingAdmin = await ctx.db
      .query("systemAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", actor._id))
      .unique();
    if (existingAdmin?.status === "revoked") throw new ConvexError("E2E actor admin is revoked");

    const now = Date.now();
    const createdAdmin = existingAdmin === null;
    if (createdAdmin) {
      await ctx.db.insert("systemAdmins", {
        userId: actor._id,
        status: "active",
        createdAt: now,
        updatedAt: now,
        grantedAt: now,
        grantReason: `e2e:${args.prefix}`,
      });
    }

    const userIds: Id<"users">[] = [];
    for (let index = 0; index < SEARCH_USER_COUNT; index += 1) {
      const createdAt = now + index;
      userIds.push(
        await ctx.db.insert("users", {
          userId: `${args.prefix}|user-${index}`,
          displayName: `${args.prefix}-user-${index}`,
          email: `${args.prefix}-user-${index}@example.test`,
          createdAt,
          updatedAt: createdAt,
        }),
      );
    }

    const groupIds: Id<"groups">[] = [];
    for (let index = 0; index < SEARCH_GROUP_COUNT; index += 1) {
      const createdAt = now + index;
      groupIds.push(
        await ctx.db.insert("groups", {
          name: `${args.prefix}-group-${index}`,
          status: groupStatuses[index % groupStatuses.length],
          createdAt,
          updatedAt: createdAt,
        }),
      );
    }

    await ctx.db.insert("e2eSystemAdminSearchFixtures", {
      prefix: args.prefix,
      actorUserId: actor._id,
      userIds,
      groupIds,
      createdAdmin,
      createdAt: now,
    });
    return { userCount: SEARCH_USER_COUNT, groupCount: SEARCH_GROUP_COUNT };
  },
});

export const cleanupSystemAdminSearchFixture = internalMutation({
  args: { actorUserId: v.string(), prefix: v.string() },
  handler: async (ctx, args) => {
    assertFixtureEnvironment(args.prefix);
    await deleteFixture(ctx, args.prefix);
    return { ok: true };
  },
});

type FixtureBody = { actorUserId?: string; prefix?: string };

async function readBody(req: Request): Promise<FixtureBody | Response> {
  try {
    return (await req.json()) as FixtureBody;
  } catch {
    return invalidJsonResponse();
  }
}

export const seedSystemAdminSearchHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E fixture is not enabled in this environment.");
  if (authError) return authError;
  const body = await readBody(req);
  if (body instanceof Response || !body.actorUserId || !body.prefix)
    return body instanceof Response ? body : invalidJsonResponse();
  try {
    const result: { userCount: number; groupCount: number } = await ctx.runMutation(
      internal.e2eHttp.e2eSystemAdminSearch.seedSystemAdminSearchFixture,
      { actorUserId: body.actorUserId, prefix: body.prefix },
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "fixture seed failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});

export const cleanupSystemAdminSearchHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E fixture is not enabled in this environment.");
  if (authError) return authError;
  const body = await readBody(req);
  if (body instanceof Response || !body.actorUserId || !body.prefix)
    return body instanceof Response ? body : invalidJsonResponse();
  try {
    await ctx.runMutation(internal.e2eHttp.e2eSystemAdminSearch.cleanupSystemAdminSearchFixture, {
      actorUserId: body.actorUserId,
      prefix: body.prefix,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "fixture cleanup failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});

import { ConvexError, v } from "convex/values";
import { httpAction } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireE2eSecret, invalidJsonResponse } from "./e2eAuth";

const prefixPattern = /^e2e-system-admin-291-[a-z0-9-]+$/;

function assertFixtureEnvironment(prefix: string) {
  if (process.env.APP_ENV === "production")
    throw new ConvexError("E2E fixture is disabled in production");
  if (!prefixPattern.test(prefix)) throw new ConvexError("invalid fixture prefix");
}

async function deleteFixture(ctx: MutationCtx, prefix: string) {
  const fixture = await ctx.db
    .query("e2eSystemAdminMembershipFixtures")
    .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
    .unique();
  if (!fixture) return;

  for (const groupId of [fixture.groupA, fixture.groupB]) {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
      .take(101);
    if (memberships.length > 100) throw new ConvexError("E2E fixture group has too many members");
    for (const membership of memberships) await ctx.db.delete(membership._id);
  }

  const targetMemberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", `${prefix}|target`))
    .take(101);
  if (targetMemberships.length > 100)
    throw new ConvexError("E2E fixture target has too many memberships");
  for (const membership of targetMemberships) await ctx.db.delete(membership._id);

  const audits = await ctx.db
    .query("systemAdminAuditLogs")
    .withIndex("by_target_user_id_and_created_at", (q) =>
      q.eq("targetUserId", fixture.targetUserId),
    )
    .take(101);
  if (audits.length > 100) throw new ConvexError("E2E fixture target has too many audit logs");
  for (const audit of audits) await ctx.db.delete(audit._id);

  for (const recipientUserId of [fixture.targetUserId, fixture.actorUserId]) {
    const notifications = await ctx.db
      .query("systemAdminNotifications")
      .withIndex("by_recipient_and_target_user_id_and_created_at", (q) =>
        q.eq("recipientUserId", recipientUserId).eq("targetUserId", fixture.targetUserId),
      )
      .take(101);
    if (notifications.length > 100)
      throw new ConvexError("E2E fixture target has too many notifications");
    for (const notification of notifications) await ctx.db.delete(notification._id);
  }

  await ctx.db.delete(fixture.groupA);
  await ctx.db.delete(fixture.groupB);
  await ctx.db.delete(fixture.targetUserId);
  await ctx.db.delete(fixture._id);
}

export const seedSystemAdminMembershipFixture = internalMutation({
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
    if (!existingAdmin) {
      const now = Date.now();
      await ctx.db.insert("systemAdmins", {
        userId: actor._id,
        status: "active",
        createdAt: now,
        updatedAt: now,
        grantedAt: now,
        grantReason: `e2e:${args.prefix}`,
      });
    }
    const now = Date.now();
    const groupA = await ctx.db.insert("groups", {
      name: `${args.prefix}-A`,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const groupB = await ctx.db.insert("groups", {
      name: `${args.prefix}-B`,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const target = await ctx.db.insert("users", {
      userId: `${args.prefix}|target`,
      displayName: "E2E membership target",
      email: `${args.prefix}@example.test`,
      activeGroupId: groupA,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("groupMembers", {
      groupId: groupA,
      userId: actor.userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("groupMembers", {
      groupId: groupB,
      userId: actor.userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("groupMembers", {
      groupId: groupA,
      userId: `${args.prefix}|target`,
      role: "member",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("e2eSystemAdminMembershipFixtures", {
      prefix: args.prefix,
      actorUserId: actor._id,
      targetUserId: target,
      groupA,
      groupB,
      createdAt: now,
    });
    return { targetUserId: target, groupA, groupB };
  },
});

export const cleanupSystemAdminMembershipFixture = internalMutation({
  args: { actorUserId: v.string(), prefix: v.string() },
  handler: async (ctx, args) => {
    assertFixtureEnvironment(args.prefix);
    await deleteFixture(ctx, args.prefix);
    const actor = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", args.actorUserId))
      .unique();
    if (actor) {
      const admin = await ctx.db
        .query("systemAdmins")
        .withIndex("by_user_id", (q) => q.eq("userId", actor._id))
        .unique();
      if (admin?.grantReason === `e2e:${args.prefix}`) await ctx.db.delete(admin._id);
    }
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

export const seedSystemAdminMembershipHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E fixture is not enabled in this environment.");
  if (authError) return authError;
  const body = await readBody(req);
  if (body instanceof Response || !body.actorUserId || !body.prefix)
    return body instanceof Response ? body : invalidJsonResponse();
  const args = { actorUserId: body.actorUserId, prefix: body.prefix };
  try {
    const result: { targetUserId: Id<"users">; groupA: Id<"groups">; groupB: Id<"groups"> } =
      await ctx.runMutation(
        internal.e2eHttp.e2eSystemAdminMembership.seedSystemAdminMembershipFixture,
        args,
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

export const cleanupSystemAdminMembershipHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E fixture is not enabled in this environment.");
  if (authError) return authError;
  const body = await readBody(req);
  if (body instanceof Response || !body.actorUserId || !body.prefix)
    return body instanceof Response ? body : invalidJsonResponse();
  const args = { actorUserId: body.actorUserId, prefix: body.prefix };
  try {
    await ctx.runMutation(
      internal.e2eHttp.e2eSystemAdminMembership.cleanupSystemAdminMembershipFixture,
      args,
    );
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

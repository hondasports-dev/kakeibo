import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const createRequest = internalMutation({
  args: {
    userId: v.string(),
    stateHash: v.string(),
    nonceHash: v.string(),
    codeVerifier: v.string(),
    expiresAt: v.number(),
  },
  returns: v.id("lineLinkRequests"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const requestId = await ctx.db.insert("lineLinkRequests", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("lineLinkAuditLogs", {
      userId: args.userId,
      action: "started",
      result: "success",
      createdAt: now,
    });
    return requestId;
  },
});

export const claimRequest = internalMutation({
  args: { stateHash: v.string(), userId: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(false), reason: v.string() }),
    v.object({
      ok: v.literal(true),
      requestId: v.id("lineLinkRequests"),
      nonceHash: v.string(),
      codeVerifier: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("lineLinkRequests")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!request || request.userId !== args.userId || request.status !== "pending") {
      return { ok: false as const, reason: "INVALID_CALLBACK" };
    }

    const now = Date.now();
    if (request.expiresAt <= now) {
      await ctx.db.patch(request._id, { status: "expired", codeVerifier: "", updatedAt: now });
      await ctx.db.insert("lineLinkAuditLogs", {
        userId: args.userId,
        action: "failed",
        result: "failure",
        reasonCode: "STATE_EXPIRED",
        createdAt: now,
      });
      return { ok: false as const, reason: "STATE_EXPIRED" };
    }

    await ctx.db.patch(request._id, { status: "claimed", claimedAt: now, updatedAt: now });
    return {
      ok: true as const,
      requestId: request._id,
      nonceHash: request.nonceHash,
      codeVerifier: request.codeVerifier,
    };
  },
});

export const finalizeRequest = internalMutation({
  args: {
    requestId: v.id("lineLinkRequests"),
    userId: v.string(),
    lineUserId: v.string(),
    nonceHash: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    const now = Date.now();
    if (
      !request ||
      request.userId !== args.userId ||
      request.status !== "claimed" ||
      request.expiresAt <= now ||
      request.nonceHash !== args.nonceHash
    ) {
      if (request?.userId === args.userId && request.status === "claimed") {
        await ctx.db.patch(request._id, { status: "failed", codeVerifier: "", updatedAt: now });
      }
      return { ok: false as const, reason: "INVALID_CALLBACK" };
    }

    const existingLineLinks = await ctx.db
      .query("lineAccountLinks")
      .withIndex("by_line_user_id_and_status", (q) =>
        q.eq("lineUserId", args.lineUserId).eq("status", "active"),
      )
      .collect();
    if (existingLineLinks.some((link) => link.userId !== args.userId)) {
      await ctx.db.patch(request._id, { status: "failed", codeVerifier: "", updatedAt: now });
      await ctx.db.insert("lineLinkAuditLogs", {
        userId: args.userId,
        action: "failed",
        result: "failure",
        reasonCode: "LINE_LINK_CONFLICT",
        createdAt: now,
      });
      return { ok: false as const, reason: "LINE_LINK_CONFLICT" };
    }

    const existingUserLinks = await ctx.db
      .query("lineAccountLinks")
      .withIndex("by_user_id_and_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
    const revokeTargetIds = new Set(
      [...existingUserLinks, ...existingLineLinks].map((link) => link._id),
    );
    for (const linkId of revokeTargetIds) {
      await ctx.db.patch(linkId, {
        status: "revoked",
        revokedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("lineAccountLinks", {
      userId: args.userId,
      lineUserId: args.lineUserId,
      status: "active",
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(request._id, {
      status: "completed",
      codeVerifier: "",
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("lineLinkAuditLogs", {
      userId: args.userId,
      action: "linked",
      result: "success",
      createdAt: now,
    });
    return { ok: true as const };
  },
});

export const recordFailedRequest = internalMutation({
  args: { requestId: v.id("lineLinkRequests"), userId: v.string(), reasonCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== args.userId || request.status !== "claimed") return null;
    const now = Date.now();
    await ctx.db.patch(request._id, { status: "failed", codeVerifier: "", updatedAt: now });
    await ctx.db.insert("lineLinkAuditLogs", {
      userId: args.userId,
      action: "failed",
      result: "failure",
      reasonCode: args.reasonCode,
      createdAt: now,
    });
    return null;
  },
});

export const expireRequests = internalMutation({
  args: { now: v.number(), limit: v.number() },
  returns: v.object({ expiredCount: v.number() }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 100);
    const requests = await ctx.db
      .query("lineLinkRequests")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", args.now))
      .take(limit);
    let expiredCount = 0;
    for (const request of requests) {
      // state再利用を拒否できればよく、期限切れverifierを保存し続けない。
      await ctx.db.delete(request._id);
      expiredCount += 1;
    }
    return { expiredCount };
  },
});

export const expireRequest = internalMutation({
  args: { requestId: v.id("lineLinkRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.expiresAt > Date.now()) return null;
    await ctx.db.delete(request._id);
    return null;
  },
});

export const clearE2eDataForUser = internalMutation({
  args: { userId: v.string() },
  returns: v.object({ deletedCount: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    const [links, requests, audits] = await Promise.all([
      ctx.db
        .query("lineAccountLinks")
        .withIndex("by_user_id_and_status", (q) => q.eq("userId", args.userId))
        .take(100),
      ctx.db
        .query("lineLinkRequests")
        .withIndex("by_user_id_and_expires_at", (q) => q.eq("userId", args.userId))
        .take(100),
      ctx.db
        .query("lineLinkAuditLogs")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .take(100),
    ]);
    for (const record of [...links, ...requests, ...audits]) await ctx.db.delete(record._id);
    return {
      deletedCount: links.length + requests.length + audits.length,
      hasMore: links.length === 100 || requests.length === 100 || audits.length === 100,
    };
  },
});

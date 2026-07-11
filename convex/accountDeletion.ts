import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthenticatedUserId } from "./users/auth";
import { readQueryDoc, readQueryDocs } from "./groups/lib/groupQueryHelpers";
import { deleteAllGroupScopedData } from "./groups/lib/deleteGroupPhysically";
import { revokeGroupInvitationsForEmailInGroup } from "./groups/invitations";
import { enqueueTransactionalEmailJobHandler } from "./email/jobs";
import { classifyAccountDeletionGroups } from "../lib/convex/accountDeletion/groupClassification";
import type { Id } from "./_generated/dataModel";

const activeStatuses = [
  "requested",
  "deleting_identity",
  "retry_wait",
  "identity_deleted",
  "finalization_retry_wait",
  "failed",
] as const;
const retryDelaysMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000] as const;
const GROUP_MEMBERSHIP_INVARIANT = "Group membership invariant violation";

async function loadClassification(ctx: Pick<QueryCtx, "db">, userId: string) {
  const memberships = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );
  const values = [];
  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId);
    // Preview treats a stale membership as a recoverable data-integrity state.
    // Keep this as a plain Error so the public query can convert it into a
    // structured response instead of leaking a ConvexError to the router.
    if (!group) throw new Error(GROUP_MEMBERSHIP_INVARIANT);
    const members = await readQueryDocs(
      ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", membership.groupId)),
    );
    values.push({
      groupId: membership.groupId,
      groupName: group.name,
      role: membership.role,
      memberCount: members.length,
      ownerCount: members.filter((row) => row.role === "owner").length,
    });
  }
  return classifyAccountDeletionGroups(
    values.map((item) => ({ ...item, groupId: item.groupId as string })),
  );
}

export async function assertAccountDeletionNotInProgress(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
) {
  const requests = await readQueryDocs(
    ctx.db.query("accountDeletionRequests").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );
  if (
    requests.some((request) =>
      activeStatuses.includes(request.status as (typeof activeStatuses)[number]),
    )
  ) {
    throw new ConvexError("アカウント削除処理中のため、この操作はできません");
  }
}

export const getAccountDeletionPreview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    try {
      const result = await loadClassification(ctx, userId);
      return {
        canDelete: result.blockingGroups.length === 0,
        errorCode: null,
        ...result,
      };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== GROUP_MEMBERSHIP_INVARIANT) {
        throw error;
      }
      return {
        canDelete: false,
        errorCode: "GROUP_MEMBERSHIP_INVARIANT",
        groupsToLeave: [],
        groupsToDelete: [],
        blockingGroups: [],
      };
    }
  },
});

export const getMyAccountDeletionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const requests = await readQueryDocs(
      ctx.db
        .query("accountDeletionRequests")
        .withIndex("by_user_id", (q) => q.eq("userId", userId)),
    );
    const request = requests.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!request || request.status === "completed") return null;
    return {
      status: request.status,
      nextRetryAt: request.nextRetryAt ?? null,
      errorCategory:
        request.status === "failed" ? (request.lastErrorCode ?? "identity_deletion_failed") : null,
    };
  },
});

export const requestAccountDeletion = mutation({
  args: { confirmationText: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    if (args.confirmationText !== "削除") throw new ConvexError("確認文言が一致しません");
    const user = await readQueryDoc(
      ctx.db
        .query("users")
        .withIndex("by_token_identifier", (q) => q.eq("userId", identity.tokenIdentifier)),
    );
    if (!user) throw new ConvexError("User not found");
    await assertAccountDeletionNotInProgress(ctx, identity.tokenIdentifier);
    const classification = await loadClassification(ctx, identity.tokenIdentifier);
    if (classification.blockingGroups.length)
      throw new ConvexError({
        code: "ACCOUNT_DELETION_BLOCKED",
        blockingGroups: classification.blockingGroups,
      });
    const now = Date.now();
    const requestId = await ctx.db.insert("accountDeletionRequests", {
      userId: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      ...(user.email ? { recipientEmailSnapshot: user.email } : {}),
      status: "requested",
      leftGroupCount: classification.groupsToLeave.length,
      deletedGroupCount: classification.groupsToDelete.length,
      attemptCount: 0,
      maxAttempts: 6,
      createdAt: now,
      updatedAt: now,
    });
    for (const group of classification.groupsToLeave) {
      const membership = await readQueryDoc(
        ctx.db
          .query("groupMembers")
          .withIndex("by_group_id_and_user_id", (q) =>
            q.eq("groupId", group.groupId as Id<"groups">).eq("userId", identity.tokenIdentifier),
          ),
      );
      if (!membership) throw new ConvexError("Group membership invariant violation");
      await ctx.db.delete(membership._id);
      if (user.email) {
        await revokeGroupInvitationsForEmailInGroup(ctx, group.groupId as Id<"groups">, user.email);
      }
    }
    for (const group of classification.groupsToDelete)
      await deleteAllGroupScopedData(ctx, group.groupId as Id<"groups">);
    await ctx.db.patch(user._id, { activeGroupId: undefined, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.accountDeletionActions.processAccountDeletion, {
      requestId,
    });
    return requestId;
  },
});

export const retryAccountDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const requests = await readQueryDocs(
      ctx.db
        .query("accountDeletionRequests")
        .withIndex("by_user_id", (q) => q.eq("userId", userId)),
    );
    const request = requests.find((item) => item.status === "failed");
    if (!request) throw new ConvexError("再試行できる退会処理がありません");
    const status = request.identityDeletedAt ? "identity_deleted" : "requested";
    await ctx.db.patch(request._id, {
      status,
      attemptCount: 0,
      nextRetryAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.accountDeletionActions.processAccountDeletion, {
      requestId: request._id,
    });
  },
});

export const getRequest = internalQuery({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => await ctx.db.get(args.requestId),
});
export const markDeletingIdentity = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status === "completed") return null;
    await ctx.db.patch(args.requestId, { status: "deleting_identity", updatedAt: Date.now() });
    return request;
  },
});
export const markIdentityDeleted = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status === "completed") return null;
    await ctx.db.patch(args.requestId, {
      status: "identity_deleted",
      identityDeletedAt: Date.now(),
      nextRetryAt: undefined,
      updatedAt: Date.now(),
    });
    return request;
  },
});
export const scheduleRetry = internalMutation({
  args: {
    requestId: v.id("accountDeletionRequests"),
    code: v.string(),
    message: v.string(),
    finalization: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status === "completed") return;
    const nextAttempt = request.attemptCount + 1;
    if (nextAttempt >= request.maxAttempts) {
      await ctx.db.patch(args.requestId, {
        status: "failed",
        attemptCount: nextAttempt,
        nextRetryAt: undefined,
        lastErrorCode: args.code,
        lastErrorMessage: args.message,
        updatedAt: Date.now(),
      });
      return;
    }
    const delay = retryDelaysMs[Math.min(nextAttempt - 1, retryDelaysMs.length - 1)];
    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: args.finalization ? "finalization_retry_wait" : "retry_wait",
      attemptCount: nextAttempt,
      nextRetryAt: now + delay,
      lastErrorCode: args.code,
      lastErrorMessage: args.message,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(delay, internal.accountDeletionActions.processAccountDeletion, {
      requestId: args.requestId,
    });
  },
});
export const finalizeAccountDeletion = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status === "completed") return;
    if (request.status !== "identity_deleted" && request.status !== "finalization_retry_wait")
      throw new ConvexError("Account deletion is not ready to finalize");
    if (request.recipientEmailSnapshot)
      await enqueueTransactionalEmailJobHandler(ctx, {
        templateType: "account_deletion_completed",
        recipientEmail: request.recipientEmailSnapshot,
        payloadJson: JSON.stringify({
          leftGroupCount: request.leftGroupCount,
          deletedGroupCount: request.deletedGroupCount,
        }),
        businessDedupeKey: `account-deletion-completed/${args.requestId}`,
      });
    const user = await readQueryDoc(
      ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", request.userId)),
    );
    if (user) await ctx.db.delete(user._id);
    await ctx.db.patch(args.requestId, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      nextRetryAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      recipientEmailSnapshot: undefined,
    });
  },
});
export const cleanupCompletedRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const requests = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_status_and_updated_at", (q) =>
        q.eq("status", "completed").lt("updatedAt", cutoff),
      )
      .take(100);
    for (const request of requests) await ctx.db.delete(request._id);
    if (requests.length === 100) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.cleanupCompletedRequests, {});
    }
  },
});

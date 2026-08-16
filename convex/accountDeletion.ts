import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthenticatedUserId } from "./users/auth";
import { readQueryDoc } from "./groups/lib/groupQueryHelpers";
import { startGroupDeletionHandler } from "./groups/groupDeletion";
import { revokeGroupInvitationsForEmailInGroup } from "./groups/invitations";
import { enqueueTransactionalEmailJobHandler } from "./email/jobs";
import { classifyAccountDeletionGroups } from "../lib/domain/accountDeletion/classification";
import { isValidAccountDeletionConfirmation } from "../lib/domain/accountDeletion/confirmation";
import { getAccountDeletionErrorCategory } from "../lib/domain/accountDeletion/errorCategory";
import { getAccountDeletionRetryDelay } from "../lib/domain/accountDeletion/retry";
import { resolveAccountDeletionResumeStatus } from "../lib/domain/accountDeletion/resume";
import { ACCOUNT_DELETION_GROUP_MEMBERSHIP_INVARIANT_MESSAGE } from "../lib/domain/accountDeletion/classification";
import {
  isAccountDeletionFinalizableStatus,
  isActiveAccountDeletionStatus,
} from "../lib/domain/accountDeletion/status";
import type { Id } from "./_generated/dataModel";

const GROUP_BATCH_SIZE = 25;

type BoundedQuery<T> = { take?: (count: number) => Promise<T[]> };

async function takeBounded<T>(query: BoundedQuery<T>, limit = GROUP_BATCH_SIZE) {
  if (typeof query.take !== "function") throw new Error("bounded query is unavailable");
  return await query.take(limit);
}

async function readClassificationRows<T>(query: BoundedQuery<T>) {
  // 分類は削除開始前の読み取り専用スナップショット。100件超を拒否せず、
  // 1トランザクションの上限内で bounded read として扱う。
  return await takeBounded(query, 10_000);
}

async function loadGroupMembershipStats(ctx: Pick<QueryCtx, "db">, groupId: Id<"groups">) {
  const members = await readClassificationRows(
    ctx.db.query("groupMembers").withIndex("by_group_id", (q) => q.eq("groupId", groupId)),
  );
  return {
    memberCount: members.length,
    ownerCount: members.filter((row) => row.role === "owner").length,
  };
}

export async function loadAccountDeletionClassification(ctx: Pick<QueryCtx, "db">, userId: string) {
  const memberships = await readClassificationRows(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );
  const values = [];
  const orphanMemberships = [];
  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId);
    // 過去の削除処理で残った孤立 membership は、共有データを持たない。
    // preview では退会可能性の判定から除外し、開始 mutation で回収する。
    if (!group) {
      orphanMemberships.push(membership);
      continue;
    }
    const { memberCount, ownerCount } = await loadGroupMembershipStats(ctx, membership.groupId);
    values.push({
      groupId: membership.groupId,
      groupName: group.name,
      role: membership.role,
      memberCount,
      ownerCount,
    });
  }
  return {
    classification: classifyAccountDeletionGroups(
      values.map((item) => ({ ...item, groupId: item.groupId as string })),
    ),
    orphanMemberships,
  };
}

export async function deleteOrphanedGroupMemberships(
  ctx: Pick<MutationCtx, "db">,
  memberships: Array<{ _id: Id<"groupMembers"> }>,
) {
  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }
}

export async function assertAccountDeletionNotInProgress(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
) {
  const requests = await takeBounded(
    ctx.db.query("accountDeletionRequests").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );
  if (requests.some((request) => isActiveAccountDeletionStatus(request.status))) {
    throw new ConvexError("アカウント削除処理中のため、この操作はできません");
  }
}

export const getAccountDeletionPreview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    try {
      const { classification } = await loadAccountDeletionClassification(ctx, userId);
      return {
        canDelete: classification.blockingGroups.length === 0,
        errorCode: null,
        ...classification,
      };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== ACCOUNT_DELETION_GROUP_MEMBERSHIP_INVARIANT_MESSAGE
      ) {
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
    const requests = await takeBounded(
      ctx.db
        .query("accountDeletionRequests")
        .withIndex("by_user_id", (q) => q.eq("userId", userId)),
    );
    const request = requests.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!request || request.status === "completed") return null;
    return {
      status: request.status,
      nextRetryAt: request.nextRetryAt ?? null,
      errorCategory: getAccountDeletionErrorCategory(request.status, request.lastErrorCode),
    };
  },
});

export const requestAccountDeletion = mutation({
  args: { confirmationText: v.string() },
  returns: v.id("accountDeletionRequests"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    if (!isValidAccountDeletionConfirmation(args.confirmationText))
      throw new ConvexError("確認文言が一致しません");
    const user = await readQueryDoc(
      ctx.db
        .query("users")
        .withIndex("by_token_identifier", (q) => q.eq("userId", identity.tokenIdentifier)),
    );
    if (!user) throw new ConvexError("User not found");
    await assertAccountDeletionNotInProgress(ctx, identity.tokenIdentifier);
    let loaded: Awaited<ReturnType<typeof loadAccountDeletionClassification>>;
    try {
      loaded = await loadAccountDeletionClassification(ctx, identity.tokenIdentifier);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== ACCOUNT_DELETION_GROUP_MEMBERSHIP_INVARIANT_MESSAGE
      )
        throw error;
      throw new ConvexError({ code: "GROUP_MEMBERSHIP_INVARIANT" });
    }
    const { classification, orphanMemberships } = loaded;
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
      status: "preparing_groups",
      leftGroupCount: classification.groupsToLeave.length,
      deletedGroupCount: classification.groupsToDelete.length,
      attemptCount: 0,
      maxAttempts: 6,
      createdAt: now,
      updatedAt: now,
    });
    await deleteOrphanedGroupMemberships(ctx, orphanMemberships);
    await ctx.db.patch(user._id, { activeGroupId: undefined, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.accountDeletion.prepareAccountDeletionBatch, {
      requestId,
    });
    return requestId;
  },
});

export const retryAccountDeletion = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const requests = await takeBounded(
      ctx.db
        .query("accountDeletionRequests")
        .withIndex("by_user_id", (q) => q.eq("userId", userId)),
    );
    const request = requests.find((item) => item.status === "failed");
    if (!request) throw new ConvexError("再試行できる退会処理がありません");
    const status = resolveAccountDeletionResumeStatus({
      identityDeletedAt: request.identityDeletedAt,
      preparationCompletedAt: request.preparationCompletedAt,
    });
    await ctx.db.patch(request._id, {
      status,
      attemptCount: 0,
      nextRetryAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      request.identityDeletedAt
        ? internal.accountDeletionActions.processAccountDeletion
        : request.preparationCompletedAt
          ? internal.accountDeletion.resetFailedAccountDeletionPurges
          : internal.accountDeletion.prepareAccountDeletionBatch,
      { requestId: request._id },
    );
    return null;
  },
});

export const resetFailedAccountDeletionPurges = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const failedPurges = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "failed"),
      )
      .take(GROUP_BATCH_SIZE);
    for (const purge of failedPurges) {
      await ctx.db.patch(purge._id, {
        status: "pending",
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.groups.groupDeletion.resumeGroupDeletion, {
        jobId: purge.groupDeletionJobId,
      });
    }
    const remaining = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "failed"),
      )
      .take(1);
    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.accountDeletion.resetFailedAccountDeletionPurges,
        args,
      );
    } else {
      await ctx.scheduler.runAfter(0, internal.accountDeletionActions.processAccountDeletion, args);
    }
  },
});

/**
 * ユーザーの membership を 25 件ずつ評価し、共有グループの離脱と
 * sole-owner グループの bounded purge job 作成を行う。
 */
export const prepareAccountDeletionBatch = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.status === "completed" ||
      request.status === "failed" ||
      request.status === "deleting_identity" ||
      request.status === "identity_deleted" ||
      request.status === "finalization_retry_wait"
    ) {
      return;
    }
    const page = await ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", request.userId))
      .paginate({ cursor: request.preparationCursor ?? null, numItems: GROUP_BATCH_SIZE });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("userId", request.userId))
      .unique();
    for (const membership of page.page) {
      const group = await ctx.db.get(membership.groupId);
      if (!group) {
        await ctx.db.delete(membership._id);
        continue;
      }
      const { memberCount, ownerCount } = await loadGroupMembershipStats(ctx, membership.groupId);
      if (membership.role === "member" || ownerCount >= 2) {
        await ctx.db.delete(membership._id);
        if (user?.email) {
          await revokeGroupInvitationsForEmailInGroup(ctx, membership.groupId, user.email);
        }
        continue;
      }
      if (memberCount !== 1) {
        await ctx.db.patch(args.requestId, {
          status: "failed",
          lastErrorCode: "account_deletion_blocked_by_membership_change",
          lastErrorMessage: "グループの所有者状態が変わったため退会処理を停止しました。",
          updatedAt: Date.now(),
        });
        return;
      }
      const targetGroupIdSnapshot = membership.groupId.toString();
      const activeJobs = await ctx.db
        .query("groupDeletionJobs")
        .withIndex("by_target_group_id_snapshot_and_is_active", (q) =>
          q.eq("targetGroupIdSnapshot", targetGroupIdSnapshot).eq("isActive", true),
        )
        .take(1);
      const activeJob = activeJobs[0];
      if (activeJob && activeJob.source !== "account_deletion") {
        await ctx.db.patch(args.requestId, {
          status: "failed",
          lastErrorCode: "group_deletion_conflict",
          lastErrorMessage: "グループの別の削除処理と競合したため退会処理を停止しました。",
          updatedAt: Date.now(),
        });
        return;
      }
      const jobId = activeJob
        ? activeJob._id
        : await startGroupDeletionHandler(ctx, {
            groupId: membership.groupId,
            source: "account_deletion",
          });
      const existingRelation = await ctx.db
        .query("accountDeletionGroupPurges")
        .withIndex("by_group_deletion_job_id", (q) => q.eq("groupDeletionJobId", jobId))
        .unique();
      if (!existingRelation) {
        const now = Date.now();
        await ctx.db.insert("accountDeletionGroupPurges", {
          requestId: args.requestId,
          groupDeletionJobId: jobId,
          targetGroupIdSnapshot,
          targetGroupNameSnapshot: group.name,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const now = Date.now();
    if (page.isDone) {
      await ctx.db.patch(args.requestId, {
        status: "purging_groups",
        preparationCursor: undefined,
        preparationCompletedAt: now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.accountDeletionActions.processAccountDeletion, args);
    } else {
      await ctx.db.patch(args.requestId, {
        status: "preparing_groups",
        preparationCursor: page.continueCursor,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.accountDeletion.prepareAccountDeletionBatch, args);
    }
  },
});

export const advanceAccountDeletionPurge = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  returns: v.union(v.literal("waiting"), v.literal("ready"), v.literal("failed")),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status === "completed") return "ready";
    if (request.status === "failed") return "failed";
    if (request.status === "preparing_groups" && !request.preparationCompletedAt) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.prepareAccountDeletionBatch, args);
      return "waiting";
    }
    const pendingRelations = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "pending"),
      )
      .take(GROUP_BATCH_SIZE);
    const runningRelations = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "running"),
      )
      .take(GROUP_BATCH_SIZE);
    const relations = [...pendingRelations, ...runningRelations].slice(0, GROUP_BATCH_SIZE);
    for (const relation of relations) {
      const job = await ctx.db.get(relation.groupDeletionJobId);
      if (!job) {
        await ctx.db.patch(relation._id, {
          status: "failed",
          lastErrorCode: "group_purge_job_missing",
          lastErrorMessage: "グループ削除ジョブが見つかりません。",
          updatedAt: Date.now(),
        });
        await ctx.db.patch(args.requestId, {
          status: "failed",
          lastErrorCode: "group_purge_job_missing",
          lastErrorMessage: "グループ削除ジョブが見つかりません。",
          updatedAt: Date.now(),
        });
        return "failed";
      }
      if (job.status === "failed") {
        await ctx.db.patch(relation._id, {
          status: "failed",
          lastErrorCode: job.lastErrorCategory ?? "group_purge_failed",
          lastErrorMessage: "グループデータの削除に失敗しました。",
          updatedAt: Date.now(),
        });
        await ctx.db.patch(args.requestId, {
          status: "failed",
          lastErrorCode: job.lastErrorCategory ?? "group_purge_failed",
          lastErrorMessage: "グループデータの削除に失敗しました。",
          updatedAt: Date.now(),
        });
        return "failed";
      }
      if (job.status === "completed") {
        await ctx.db.patch(relation._id, {
          status: "completed",
          completedAt: job.completedAt ?? Date.now(),
          updatedAt: Date.now(),
        });
      } else if (relation.status === "pending") {
        await ctx.db.patch(relation._id, { status: "running", updatedAt: Date.now() });
      }
    }
    const pending = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "pending"),
      )
      .take(1);
    const failed = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "failed"),
      )
      .take(1);
    if (failed.length > 0) {
      await ctx.db.patch(args.requestId, {
        status: "failed",
        lastErrorCode: failed[0].lastErrorCode ?? "group_purge_failed",
        lastErrorMessage: failed[0].lastErrorMessage ?? "グループデータの削除に失敗しました。",
        updatedAt: Date.now(),
      });
      return "failed";
    }
    const running = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id_and_status", (q) =>
        q.eq("requestId", args.requestId).eq("status", "running"),
      )
      .take(1);
    if (pending.length > 0 || running.length > 0) {
      await ctx.scheduler.runAfter(
        60_000,
        internal.accountDeletionActions.processAccountDeletion,
        args,
      );
      return "waiting";
    }
    await ctx.db.patch(args.requestId, { status: "requested", updatedAt: Date.now() });
    return "ready";
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
      attemptCount: 0,
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
    const delay = getAccountDeletionRetryDelay(nextAttempt - 1);
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
    if (!isAccountDeletionFinalizableStatus(request.status))
      throw new ConvexError("Account deletion is not ready to finalize");
    const purgeRelations = await ctx.db
      .query("accountDeletionGroupPurges")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .take(GROUP_BATCH_SIZE);
    if (purgeRelations.length > 0) {
      for (const relation of purgeRelations) await ctx.db.delete(relation._id);
      await ctx.scheduler.runAfter(0, internal.accountDeletion.finalizeAccountDeletion, args);
      return;
    }
    const lineWebhookEvents = await ctx.db
      .query("lineWebhookEvents")
      .withIndex("by_user_id_and_created_at", (q) => q.eq("userId", request.userId))
      .take(GROUP_BATCH_SIZE);
    if (lineWebhookEvents.length > 0) {
      for (const event of lineWebhookEvents) await ctx.db.delete(event._id);
      await ctx.scheduler.runAfter(0, internal.accountDeletion.finalizeAccountDeletion, args);
      return;
    }
    const lineImageJobs = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_user_id_and_created_at", (q) => q.eq("userId", request.userId))
      .take(GROUP_BATCH_SIZE);
    if (lineImageJobs.length > 0) {
      for (const job of lineImageJobs) await ctx.db.delete(job._id);
      await ctx.scheduler.runAfter(0, internal.accountDeletion.finalizeAccountDeletion, args);
      return;
    }
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

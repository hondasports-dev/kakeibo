// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";
import { processGroupDeletionFailureNotificationHandler, recordRetry } from "./groupDeletion";
import { zeroDeletedCounts } from "./groupDeletion.test.fixtures";

describe("group deletion operations", () => {
  it("terminal failure通知はrequesterへjob lifetimeで1回だけenqueueする", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, convexTestModules);
      const jobId = await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          userId: "issuer|requester",
          displayName: "削除依頼者",
          email: "requester@example.test",
          createdAt: 1,
          updatedAt: 1,
        });
        return await ctx.db.insert("groupDeletionJobs", {
          targetGroupIdSnapshot: "00000000000000000000010000groups",
          targetGroupNameSnapshot: "失敗対象家計",
          source: "owner",
          actorUserIdSnapshot: "issuer|requester",
          status: "running",
          stage: "categories",
          isActive: true,
          attemptCount: 5,
          maxAttempts: 6,
          deletedCounts: zeroDeletedCounts(),
          createdAt: 1,
          updatedAt: 1,
        });
      });

      await t.run(async (ctx) => {
        const job = await ctx.db.get(jobId);
        if (job === null) throw new Error("test job not found");
        await recordRetry(ctx, job);
      });
      await t.mutation(internal.groups.groupDeletion.processGroupDeletionFailureNotification, {
        jobId,
      });
      await t.mutation(internal.groups.groupDeletion.processGroupDeletionFailureNotification, {
        jobId,
      });

      const state = await t.run(async (ctx) => ({
        job: await ctx.db.get(jobId),
        emails: (await ctx.db.query("transactionalEmailJobs").collect()).filter(
          (email) => email.templateType === "group_deletion_failed",
        ),
      }));
      expect(state.job).toMatchObject({
        status: "failed",
        isActive: false,
        failureNotificationAttemptCount: 1,
        failureNotificationHandledAt: expect.any(Number),
      });
      expect(state.emails).toHaveLength(1);
      expect(state.emails[0]?.businessDedupeKey).toBe(`${jobId}:failed:issuer|requester`);
      expect(JSON.parse(state.emails[0]?.payloadJson ?? "{}")).toEqual({
        groupName: "失敗対象家計",
        jobId,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminal failure通知のenqueue失敗は独立した再試行を予約する", async () => {
    const t = convexTest(schema, convexTestModules);
    const jobId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "issuer|retry-requester",
        displayName: "再試行依頼者",
        email: "retry-requester@example.test",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("groupDeletionJobs", {
        targetGroupIdSnapshot: "00000000000000000000010000groups",
        targetGroupNameSnapshot: "通知再試行家計",
        source: "owner",
        actorUserIdSnapshot: "issuer|retry-requester",
        status: "failed",
        stage: "categories",
        isActive: false,
        attemptCount: 6,
        maxAttempts: 6,
        deletedCounts: zeroDeletedCounts(),
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.run(async (ctx) => {
      await processGroupDeletionFailureNotificationHandler(ctx, { jobId }, async () => {
        throw new Error("temporary queue failure");
      });
    });

    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));
    expect(state.job).toMatchObject({
      status: "failed",
      failureNotificationAttemptCount: 1,
    });
    expect(state.job?.failureNotificationHandledAt).toBeUndefined();
    expect(state.scheduled).toHaveLength(1);
  });

  it("group削除後にfailedとなったfinalSweep jobを通知stageへ再開できる", async () => {
    const t = convexTest(schema, convexTestModules);
    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("groupDeletionJobs", {
        targetGroupIdSnapshot: "00000000000000000000010000groups",
        targetGroupNameSnapshot: "削除済み家計",
        source: "owner",
        actorUserIdSnapshot: "issuer|owner",
        status: "failed",
        stage: "finalSweep",
        isActive: false,
        attemptCount: 6,
        maxAttempts: 6,
        lastErrorCategory: "batch_processing_failed",
        deletedCounts: { ...zeroDeletedCounts(), groups: 1 },
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.mutation(internal.groups.groupDeletion.resumeGroupDeletion, { jobId });

    expect(await t.run(async (ctx) => await ctx.db.get(jobId))).toMatchObject({
      status: "requested",
      stage: "finalSweep",
      isActive: true,
      attemptCount: 0,
    });
  });

  it("archived groupの削除jobは開始しない", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await t.run(async (ctx) =>
      ctx.db.insert("groups", {
        name: "アーカイブ済み家計",
        status: "archived",
        archivedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    await expect(
      t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
        groupId,
        source: "owner",
      }),
    ).rejects.toThrow("アーカイブ済みグループは削除できません");
    const state = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("groupDeletionJobs").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));
    expect(state.jobs).toHaveLength(0);
    expect(state.scheduled).toHaveLength(0);
  });

  it("retry_waitの期限前実行は削除せず残り時間で再予約する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    try {
      const t = convexTest(schema, convexTestModules);
      const { groupId, jobId } = await t.run(async (ctx) => {
        const groupId = await ctx.db.insert("groups", {
          name: "待機中家計",
          status: "deleting",
          createdAt: 1,
          updatedAt: 1,
        });
        const jobId = await ctx.db.insert("groupDeletionJobs", {
          targetGroupIdSnapshot: groupId,
          targetGroupNameSnapshot: "待機中家計",
          source: "owner",
          status: "retry_wait",
          stage: "categories",
          isActive: true,
          attemptCount: 1,
          maxAttempts: 6,
          nextRetryAt: 61_000,
          lastErrorCategory: "batch_processing_failed",
          deletedCounts: zeroDeletedCounts(),
          createdAt: 1,
          updatedAt: 1,
        });
        return { groupId, jobId };
      });

      await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
      const state = await t.run(async (ctx) => ({
        group: await ctx.db.get(groupId),
        job: await ctx.db.get(jobId),
        scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
      }));
      expect(state.group).not.toBeNull();
      expect(state.job).toMatchObject({
        status: "retry_wait",
        stage: "categories",
        nextRetryAt: 61_000,
      });
      expect(state.scheduled).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("内部status queryで進捗snapshotを取得できる", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await t.run(async (ctx) =>
      ctx.db.insert("groups", {
        name: "進捗確認家計",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const jobId = await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
      groupId,
      source: "account_deletion",
      actorUserIdSnapshot: "issuer|owner",
    });

    const status = await t.query(internal.groups.groupDeletion.getGroupDeletionStatus, {
      jobId,
    });
    expect(status).toMatchObject({
      jobId,
      targetGroupIdSnapshot: groupId,
      targetGroupNameSnapshot: "進捗確認家計",
      source: "account_deletion",
      actorUserIdSnapshot: "issuer|owner",
      status: "requested",
      stage: "receiptAnalysisImageJobs",
      isActive: true,
    });
  });

  it("failed jobを同じstageから明示的に再開する", async () => {
    const t = convexTest(schema, convexTestModules);
    const { jobId } = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "再開対象家計",
        status: "deleting",
        createdAt: 1,
        updatedAt: 1,
      });
      const jobId = await ctx.db.insert("groupDeletionJobs", {
        targetGroupIdSnapshot: groupId,
        targetGroupNameSnapshot: "再開対象家計",
        source: "owner",
        status: "failed",
        stage: "categories",
        isActive: false,
        attemptCount: 6,
        maxAttempts: 6,
        lastErrorCategory: "batch_processing_failed",
        deletedCounts: zeroDeletedCounts(),
        createdAt: 1,
        updatedAt: 1,
      });
      return { jobId };
    });

    await t.mutation(internal.groups.groupDeletion.resumeGroupDeletion, { jobId });
    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));
    expect(state.job).toMatchObject({
      status: "requested",
      stage: "categories",
      isActive: true,
      attemptCount: 0,
    });
    expect(state.job?.nextRetryAt).toBeUndefined();
    expect(state.job?.lastErrorCategory).toBeUndefined();
    expect(state.scheduled).toHaveLength(1);

    await expect(
      t.mutation(internal.groups.groupDeletion.resumeGroupDeletion, { jobId }),
    ).rejects.toThrow("failed状態の削除ジョブだけを再開できます");
  });
});

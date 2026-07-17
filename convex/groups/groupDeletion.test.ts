// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";
import { recordRetry } from "./groupDeletion";

function zeroDeletedCounts() {
  return {
    receiptAnalysisImageJobs: 0,
    aiExpenseDraftItems: 0,
    aiExpenseDrafts: 0,
    receiptAnalysisBatches: 0,
    expenseEntries: 0,
    receipts: 0,
    sourceDocuments: 0,
    storageFiles: 0,
    weekSessions: 0,
    categories: 0,
    groupInvitations: 0,
    managementAuditLogs: 0,
    groupMembers: 0,
    groups: 0,
  };
}

describe("group deletion start", () => {
  it("job作成・deleting遷移・worker予約を同一transactionで開始する", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await t.run(async (ctx) => {
      return await ctx.db.insert("groups", {
        name: "削除対象家計",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const jobId = await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
      groupId,
      source: "owner",
      actorUserIdSnapshot: "issuer|owner",
    });

    const state = await t.run(async (ctx) => ({
      group: await ctx.db.get(groupId),
      job: await ctx.db.get(jobId),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));

    expect(state.group?.status).toBe("deleting");
    expect(state.job).toMatchObject({
      targetGroupIdSnapshot: groupId,
      targetGroupNameSnapshot: "削除対象家計",
      source: "owner",
      actorUserIdSnapshot: "issuer|owner",
      status: "requested",
      stage: "recipientSnapshot",
      isActive: true,
      attemptCount: 0,
    });
    expect(state.scheduled).toHaveLength(1);
  });

  it("同じgroupの未完了jobを重複作成しない", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await t.run(async (ctx) => {
      return await ctx.db.insert("groups", {
        name: "重複防止家計",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
      groupId,
      source: "owner",
    });

    await expect(
      t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
        groupId,
        source: "owner",
      }),
    ).rejects.toThrow("このグループの削除処理はすでに開始されています");

    const jobs = await t.run(async (ctx) => {
      return await ctx.db
        .query("groupDeletionJobs")
        .withIndex("by_target_group_id_snapshot_and_is_active", (q) =>
          q.eq("targetGroupIdSnapshot", groupId).eq("isActive", true),
        )
        .take(2);
    });
    expect(jobs).toHaveLength(1);
  });
});

describe("group deletion worker", () => {
  it("owner削除は旧memberをbounded recipientへsnapshotしてからpurgeへ進む", async () => {
    const t = convexTest(schema, convexTestModules);
    const { groupId, jobId } = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "通知対象家計",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      for (const [index, userId] of ["issuer|owner", "issuer|member"].entries()) {
        await ctx.db.insert("users", {
          userId,
          displayName: userId,
          email: `${index}@example.test`,
          activeGroupId: groupId,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("groupMembers", {
          groupId,
          userId,
          role: index === 0 ? "owner" : "member",
          createdAt: 1,
          updatedAt: 1,
        });
      }
      const jobId = await ctx.db.insert("groupDeletionJobs", {
        targetGroupIdSnapshot: groupId,
        targetGroupNameSnapshot: "通知対象家計",
        source: "owner",
        actorUserIdSnapshot: "issuer|owner",
        status: "requested",
        stage: "recipientSnapshot",
        isActive: true,
        attemptCount: 0,
        maxAttempts: 6,
        deletedCounts: zeroDeletedCounts(),
        createdAt: 1,
        updatedAt: 1,
      });
      return { groupId, jobId };
    });

    await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });

    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      recipients: await ctx.db
        .query("groupDeletionNotificationRecipients")
        .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
        .take(10),
      members: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(10),
    }));
    expect(state.job?.stage).toBe("startedEnqueue");
    expect(state.recipients.map((recipient) => recipient.recipientUserId).sort()).toEqual([
      "issuer|member",
      "issuer|owner",
    ]);
    expect(state.members).toHaveLength(2);
  });

  it("25件を超える旧memberは複数batchで全員をsnapshotしてからpurgeへ進む", async () => {
    const t = convexTest(schema, convexTestModules);
    const { groupId, jobId } = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("groups", {
        name: "大人数家計",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      for (let index = 0; index < 55; index += 1) {
        await ctx.db.insert("groupMembers", {
          groupId,
          userId: `issuer|member-${index}`,
          role: index === 0 ? "owner" : "member",
          createdAt: index + 1,
          updatedAt: index + 1,
        });
      }
      const jobId = await ctx.db.insert("groupDeletionJobs", {
        targetGroupIdSnapshot: groupId,
        targetGroupNameSnapshot: "大人数家計",
        source: "owner",
        actorUserIdSnapshot: "issuer|member-0",
        status: "requested",
        stage: "recipientSnapshot",
        isActive: true,
        attemptCount: 0,
        maxAttempts: 6,
        deletedCounts: zeroDeletedCounts(),
        createdAt: 1,
        updatedAt: 1,
      });
      return { groupId, jobId };
    });

    await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
    await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
    const midState = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      recipients: await ctx.db
        .query("groupDeletionNotificationRecipients")
        .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
        .take(100),
      members: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(100),
    }));
    expect(midState.job?.stage).toBe("recipientSnapshot");
    expect(midState.recipients).toHaveLength(50);
    expect(midState.members).toHaveLength(55);

    await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
    const completedSnapshot = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      recipients: await ctx.db
        .query("groupDeletionNotificationRecipients")
        .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
        .take(100),
      members: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
        .take(100),
    }));
    expect(completedSnapshot.job?.stage).toBe("startedEnqueue");
    expect(completedSnapshot.recipients).toHaveLength(55);
    expect(completedSnapshot.members).toHaveLength(55);
  });

  it("開始・完了通知を旧memberごとに1回enqueueしてrecipientを片付けてから完了する", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, convexTestModules);
      const { groupId } = await t.run(async (ctx) => {
        const groupId = await ctx.db.insert("groups", {
          name: "通知完了家計",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        });
        for (const [index, userId] of ["issuer|owner", "issuer|member"].entries()) {
          await ctx.db.insert("users", {
            userId,
            displayName: userId,
            email: `${index}@example.test`,
            activeGroupId: groupId,
            createdAt: 1,
            updatedAt: 1,
          });
          await ctx.db.insert("groupMembers", {
            groupId,
            userId,
            role: index === 0 ? "owner" : "member",
            createdAt: 1,
            updatedAt: 1,
          });
        }
        return { groupId };
      });
      const jobId = await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
        groupId,
        source: "owner",
        actorUserIdSnapshot: "issuer|owner",
      });

      for (let batch = 0; batch < 100; batch += 1) {
        await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
        const status = await t.run(async (ctx) => (await ctx.db.get(jobId))?.status);
        if (status === "completed") break;
      }

      const state = await t.run(async (ctx) => ({
        job: await ctx.db.get(jobId),
        recipients: await ctx.db
          .query("groupDeletionNotificationRecipients")
          .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
          .take(10),
        emails: await ctx.db.query("transactionalEmailJobs").take(20),
      }));
      expect(state.job?.status).toBe("completed");
      expect(state.recipients).toHaveLength(0);
      expect(
        state.emails.filter((email) => email.templateType === "group_deletion_started"),
      ).toHaveLength(2);
      expect(state.emails.filter((email) => email.templateType === "group_deleted")).toHaveLength(
        2,
      );
      expect(new Set(state.emails.map((email) => email.businessDedupeKey)).size).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("複数batchで関連データとgroupを削除し完了状態を記録する", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, convexTestModules);
      const { groupId, userIds } = await t.run(async (ctx) => {
        const groupId = await ctx.db.insert("groups", {
          name: "一括削除家計",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        });
        const userIds: Array<string> = [];
        for (let index = 0; index < 55; index += 1) {
          const userId = `issuer|member-${index}`;
          userIds.push(userId);
          await ctx.db.insert("users", {
            userId,
            displayName: `member-${index}`,
            activeGroupId: groupId,
            createdAt: 1,
            updatedAt: 1,
          });
          await ctx.db.insert("groupMembers", {
            groupId,
            userId,
            role: index === 0 ? "owner" : "member",
            createdAt: 1,
            updatedAt: 1,
          });
        }
        return { groupId, userIds };
      });

      const jobId = await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
        groupId,
        source: "owner",
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const state = await t.run(async (ctx) => ({
        group: await ctx.db.get(groupId),
        job: await ctx.db.get(jobId),
        members: await ctx.db
          .query("groupMembers")
          .withIndex("by_group_id", (q) => q.eq("groupId", groupId))
          .collect(),
        users: await Promise.all(
          userIds.map((userId) =>
            ctx.db
              .query("users")
              .withIndex("by_token_identifier", (q) => q.eq("userId", userId))
              .unique(),
          ),
        ),
      }));

      expect(state.group).toBeNull();
      expect(state.members).toHaveLength(0);
      expect(state.users.every((user) => user?.activeGroupId === undefined)).toBe(true);
      expect(state.job).toMatchObject({
        status: "completed",
        stage: "finalSweep",
        isActive: false,
        deletedCounts: {
          groupMembers: 55,
          groups: 1,
        },
      });
      expect(state.job?.completedAt).toBeTypeOf("number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("storage実体が存在する画像だけを削除しsource documentはどちらも完了する", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, convexTestModules);
      const { groupId, storedFileId, missingFileId } = await t.run(async (ctx) => {
        const groupId = await ctx.db.insert("groups", {
          name: "画像付き家計",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        });
        const storedFileId = await ctx.storage.store(new Blob(["stored"]));
        const missingFileId = await ctx.storage.store(new Blob(["missing"]));
        await ctx.storage.delete(missingFileId);
        for (const imageStorageId of [storedFileId, missingFileId]) {
          await ctx.db.insert("sourceDocuments", {
            groupId,
            sourceType: "receipt",
            status: "ready",
            imageStorageId,
            createdAt: 1,
            updatedAt: 1,
          });
        }
        return { groupId, storedFileId, missingFileId };
      });

      const jobId = await t.mutation(internal.groups.groupDeletion.startGroupDeletion, {
        groupId,
        source: "owner",
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const state = await t.run(async (ctx) => ({
        stored: await ctx.db.system.get("_storage", storedFileId),
        missing: await ctx.db.system.get("_storage", missingFileId),
        documents: await ctx.db
          .query("sourceDocuments")
          .withIndex("by_group_id_and_date", (q) => q.eq("groupId", groupId))
          .collect(),
        job: await ctx.db.get(jobId),
      }));

      expect(state.stored).toBeNull();
      expect(state.missing).toBeNull();
      expect(state.documents).toHaveLength(0);
      expect(state.job?.deletedCounts).toMatchObject({
        sourceDocuments: 2,
        storageFiles: 1,
        groups: 1,
      });
      expect(state.job?.status).toBe("completed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("final sweepで前段へ後着したデータを検出して削除を再開する", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, convexTestModules);
      const { groupId, jobId } = await t.run(async (ctx) => {
        const groupId = await ctx.db.insert("groups", {
          name: "後着確認家計",
          status: "deleting",
          createdAt: 1,
          updatedAt: 1,
        });
        const jobId = await ctx.db.insert("groupDeletionJobs", {
          targetGroupIdSnapshot: groupId,
          targetGroupNameSnapshot: "後着確認家計",
          source: "owner",
          status: "running",
          stage: "finalSweep",
          isActive: true,
          attemptCount: 0,
          maxAttempts: 6,
          deletedCounts: zeroDeletedCounts(),
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("categories", {
          groupId,
          name: "後着カテゴリ",
          color: "#000000",
          isActive: true,
          sortOrder: 1,
          createdAt: 1,
          updatedAt: 1,
        });
        return { groupId, jobId };
      });

      await t.mutation(internal.groups.groupDeletion.processGroupDeletionBatch, { jobId });
      const rewoundJob = await t.run(async (ctx) => await ctx.db.get(jobId));
      expect(rewoundJob?.stage).toBe("categories");
      expect(await t.run(async (ctx) => await ctx.db.get(groupId))).not.toBeNull();

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const completedJob = await t.run(async (ctx) => await ctx.db.get(jobId));
      expect(completedJob).toMatchObject({
        status: "completed",
        isActive: false,
        deletedCounts: { categories: 1, groups: 1 },
      });
      expect(await t.run(async (ctx) => await ctx.db.get(groupId))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("group deletion operations", () => {
  it("terminal failure通知はrequesterへjob lifetimeで1回だけenqueueする", async () => {
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
    await t.run(async (ctx) => {
      const job = await ctx.db.get(jobId);
      if (job === null) throw new Error("test job not found");
      await recordRetry(ctx, job);
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
      failureNotificationHandledAt: expect.any(Number),
    });
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0]?.businessDedupeKey).toBe(`${jobId}:failed:issuer|requester`);
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

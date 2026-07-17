// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";

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
      stage: "receiptAnalysisImageJobs",
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

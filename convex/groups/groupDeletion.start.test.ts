// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";

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

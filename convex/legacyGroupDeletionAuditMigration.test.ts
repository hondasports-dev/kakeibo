// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { convexTestModules } from "./test.setup";

const orphanGroupId = async (t: ReturnType<typeof convexTest>, index: number) =>
  await t.run(async (ctx) => {
    const groupId = await ctx.db.insert("groups", {
      name: `削除済み${index}`,
      status: "deleted",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.delete(groupId);
    return groupId;
  });

async function insertAuditLog(
  t: ReturnType<typeof convexTest>,
  groupId: Id<"groups">,
  afterValue: string | undefined,
  action: "group_deleted" | "owner_transferred" = "group_deleted",
) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("managementAuditLogs", {
        groupId,
        actorUserId: "issuer|legacy-actor",
        action,
        targetKind: "group",
        targetLabel: "削除済み家計",
        afterValue,
        createdAt: Date.now(),
      }),
  );
}

describe("legacy group deletion audit migration", () => {
  it("validな孤立group_deletedだけを最小台帳へ移し、skipと既存groupを保持する", async () => {
    const t = convexTest(schema, convexTestModules);
    const validGroupId = await orphanGroupId(t, 1);
    const invalidGroupId = await orphanGroupId(t, 2);
    const existingGroupId = await t.run(
      async (ctx) =>
        await ctx.db.insert("groups", {
          name: "現存家計",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        }),
    );
    await insertAuditLog(
      t,
      validGroupId,
      JSON.stringify({ affectedCounts: { groups: 1, managementAuditLogs: 2 } }),
    );
    await insertAuditLog(t, invalidGroupId, "not-json");
    await insertAuditLog(t, existingGroupId, JSON.stringify({ affectedCounts: { groups: 1 } }));
    await insertAuditLog(
      t,
      invalidGroupId,
      JSON.stringify({ affectedCounts: { groups: 1 } }),
      "owner_transferred",
    );

    const dryRun = await t.query(internal.legacyGroupDeletionAuditMigration.dryRun, {});
    expect(dryRun).toMatchObject({ orphaned: 2, convertible: 1, skipped: 1 });
    const result = await t.mutation(internal.legacyGroupDeletionAuditMigration.executeBatch, {});
    expect(result).toMatchObject({ isDone: true, migrated: 1, skipped: 1 });

    const state = await t.run(async (ctx) => ({
      records: await ctx.db.query("groupDeletionAuditMigrationRecords").take(10),
      logs: await ctx.db.query("managementAuditLogs").take(10),
    }));
    expect(state.records).toHaveLength(2);
    expect(state.records).toContainEqual(
      expect.objectContaining({
        recordKind: "legacy_audit",
        status: "migrated",
        deletedCounts: expect.objectContaining({ groups: 1, managementAuditLogs: 2 }),
      }),
    );
    expect(state.records).toContainEqual(
      expect.objectContaining({ status: "skipped", skipReason: "invalid_after_value_json" }),
    );
    expect(state.logs).toHaveLength(3);
    expect(state.logs.some((log) => log.groupId === existingGroupId)).toBe(true);
    await expect(
      t.query(internal.legacyGroupDeletionAuditMigration.verify, {}),
    ).resolves.toMatchObject({ remainingOrphaned: 1, unmigrated: 0, skipped: 1 });

    const retry = await t.mutation(internal.legacyGroupDeletionAuditMigration.executeBatch, {});
    expect(retry.migrated).toBe(0);
    expect(
      await t.run(async (ctx) => ctx.db.query("groupDeletionAuditMigrationRecords").take(10)),
    ).toHaveLength(2);
  });

  it("25件単位でcursorを継続し、26件目を取りこぼさない", async () => {
    const t = convexTest(schema, convexTestModules);
    for (let index = 0; index < 26; index += 1) {
      const groupId = await orphanGroupId(t, index);
      await insertAuditLog(t, groupId, JSON.stringify({ affectedCounts: { groups: 1 } }));
    }

    const first = await t.mutation(internal.legacyGroupDeletionAuditMigration.executeBatch, {});
    expect(first.isDone).toBe(false);
    expect(first.migrated).toBe(25);
    const second = await t.mutation(internal.legacyGroupDeletionAuditMigration.executeBatch, {
      cursor: first.continueCursor ?? undefined,
    });
    expect(second.isDone).toBe(true);
    expect(second.migrated).toBe(1);
    expect(
      await t.run(async (ctx) => ctx.db.query("groupDeletionAuditMigrationRecords").take(30)),
    ).toHaveLength(26);
  });
});

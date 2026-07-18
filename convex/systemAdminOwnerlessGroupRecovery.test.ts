// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { convexTestModules } from "./test.setup";

const identity = (userId: string) => ({
  tokenIdentifier: userId,
  subject: `clerk-${userId}`,
  issuer: "https://issuer.example",
});

async function seed(t: ReturnType<typeof convexTest>, owner = false) {
  return t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      userId: "admin",
      displayName: "管理者",
      createdAt: 1,
      updatedAt: 1,
    });
    const target = await ctx.db.insert("users", {
      userId: "target",
      displayName: "対象member",
      email: "target@example.test",
      createdAt: 1,
      updatedAt: 1,
    });
    const group = await ctx.db.insert("groups", {
      name: "owner不在家計",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("systemAdmins", {
      userId: admin,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
      grantedAt: 1,
      grantReason: "test",
    });
    await ctx.db.insert("groupMembers", {
      groupId: group,
      userId: "target",
      role: "member",
      createdAt: 1,
      updatedAt: 1,
    });
    if (owner) {
      await ctx.db.insert("groupMembers", {
        groupId: group,
        userId: "existing-owner",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
    }
    return { admin, target, group };
  });
}

describe("system admin ownerless group recovery", () => {
  it("owner 0の既存memberをownerへ昇格し、監査と通知を記録する", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t);
    await t
      .withIdentity(identity("admin"))
      .mutation(api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup, {
        groupId: fixture.group,
        targetUserId: fixture.target,
        reason: "緊急復旧",
      });
    const state = await t.run(async (ctx) => ({
      membership: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id_and_user_id", (q) =>
          q.eq("groupId", fixture.group).eq("userId", "target"),
        )
        .unique(),
      audit: await ctx.db.query("systemAdminAuditLogs").take(10),
      notifications: await ctx.db.query("systemAdminNotifications").take(10),
    }));
    expect(state.membership?.role).toBe("owner");
    expect(state.audit[0]).toMatchObject({
      action: "system_admin_ownerless_group_recovered",
      beforeOwnerCount: 0,
      afterOwnerCount: 1,
      targetUserId: fixture.target,
      reason: "緊急復旧",
    });
    expect(state.notifications).toHaveLength(2);
  });

  it("ownerが存在する場合は通常操作へ誘導して拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t, true);
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup, {
          groupId: fixture.group,
          targetUserId: fixture.target,
          reason: "復旧",
        }),
    ).rejects.toThrow("ownerが存在するグループは通常のowner操作を使ってください");
  });

  it("memberでない対象と認証なしを拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t);
    const other = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        userId: "other",
        displayName: "別ユーザー",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup, {
          groupId: fixture.group,
          targetUserId: other,
          reason: "復旧",
        }),
    ).rejects.toThrow("対象ユーザーは既存memberではありません");
    await expect(
      t.mutation(api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup, {
        groupId: fixture.group,
        targetUserId: fixture.target,
        reason: "復旧",
      }),
    ).rejects.toThrow("システム管理者権限が必要です");
  });
});

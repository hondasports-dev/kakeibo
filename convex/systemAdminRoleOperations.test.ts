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

async function seed(t: ReturnType<typeof convexTest>, ownerCount = 1) {
  return t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      userId: "admin",
      displayName: "管理者",
      createdAt: 1,
      updatedAt: 1,
    });
    const owner = await ctx.db.insert("users", {
      userId: "owner",
      displayName: "Owner",
      createdAt: 1,
      updatedAt: 1,
    });
    const target = await ctx.db.insert("users", {
      userId: "target",
      displayName: "Target",
      email: "target@example.test",
      createdAt: 1,
      updatedAt: 1,
    });
    const secondOwner =
      ownerCount > 1
        ? await ctx.db.insert("users", {
            userId: "second-owner",
            displayName: "Second Owner",
            createdAt: 1,
            updatedAt: 1,
          })
        : undefined;
    const group = await ctx.db.insert("groups", {
      name: "Role Group",
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
    if (ownerCount > 0)
      await ctx.db.insert("groupMembers", {
        groupId: group,
        userId: "owner",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
    if (ownerCount > 1)
      await ctx.db.insert("groupMembers", {
        groupId: group,
        userId: "second-owner",
        role: "owner",
        createdAt: 1,
        updatedAt: 1,
      });
    await ctx.db.insert("groupMembers", {
      groupId: group,
      userId: "target",
      role: "member",
      createdAt: 1,
      updatedAt: 1,
    });
    return { admin, owner, target, secondOwner, group };
  });
}

describe("system admin role operations", () => {
  it("member→ownerへ昇格し監査・通知を記録する", async () => {
    const t = convexTest(schema, convexTestModules);
    const f = await seed(t);
    await t
      .withIdentity(identity("admin"))
      .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
        operation: "change_role",
        groupId: f.group,
        targetUserId: f.target,
        newRole: "owner",
        reason: "権限整理",
      });
    const result = await t.run(async (ctx) => ({
      member: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id_and_user_id", (q) =>
          q.eq("groupId", f.group).eq("userId", "target"),
        )
        .unique(),
      audit: await ctx.db.query("systemAdminAuditLogs").take(10),
      notifications: await ctx.db.query("systemAdminNotifications").take(10),
    }));
    expect(result.member?.role).toBe("owner");
    expect(result.audit[0]).toMatchObject({
      action: "system_admin_group_role_changed",
      beforeMembershipStatus: "member",
      afterMembershipStatus: "owner",
      reason: "権限整理",
    });
    expect(result.notifications.length).toBeGreaterThan(0);
  });

  it("owner付替えはtarget昇格→source降格を同一mutationで行う", async () => {
    const t = convexTest(schema, convexTestModules);
    const f = await seed(t, 2);
    await t
      .withIdentity(identity("admin"))
      .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
        operation: "transfer_owner",
        groupId: f.group,
        sourceOwnerUserId: f.owner,
        targetUserId: f.target,
        reason: "担当変更",
      });
    const roles = await t.run(
      async (ctx) =>
        await ctx.db
          .query("groupMembers")
          .withIndex("by_group_id", (q) => q.eq("groupId", f.group))
          .take(10),
    );
    expect(roles.find((m) => m.userId === "owner")?.role).toBe("member");
    expect(roles.find((m) => m.userId === "target")?.role).toBe("owner");
    const audit = await t.run(async (ctx) => await ctx.db.query("systemAdminAuditLogs").take(10));
    expect(audit[0]).toMatchObject({
      action: "system_admin_group_owner_transferred",
      beforeMembershipStatus: "member",
      afterMembershipStatus: "owner",
      targetDisplayNameSnapshot: "Target",
      sourceUserId: f.owner,
      sourceUserDisplayNameSnapshot: "Owner",
    });
    const notifications = await t.run(
      async (ctx) => await ctx.db.query("systemAdminNotifications").take(10),
    );
    expect(notifications.map((notification) => notification.recipientUserId)).toEqual(
      expect.arrayContaining([f.admin, f.owner, f.target, f.secondOwner]),
    );
  });

  it("最後のowner降格、ownerなしgroup、非adminを拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    const f = await seed(t);
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: f.group,
          targetUserId: f.owner,
          newRole: "member",
          reason: "降格",
        }),
    ).rejects.toThrow("最後のowner");
    const ownerlessT = convexTest(schema, convexTestModules);
    const ownerless = await seed(ownerlessT, 0);
    await expect(
      ownerlessT
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: ownerless.group,
          targetUserId: ownerless.target,
          newRole: "owner",
          reason: "昇格",
        }),
    ).rejects.toThrow("owner不在");
    await expect(
      t
        .withIdentity(identity("none"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: f.group,
          targetUserId: f.target,
          newRole: "owner",
          reason: "昇格",
        }),
    ).rejects.toThrow("システム管理者権限が必要です");
  });

  it("inactive group、非member、削除処理中は状態を変更しない", async () => {
    const t = convexTest(schema, convexTestModules);
    const f = await seed(t, 2);
    const snapshot = () =>
      t.run(async (ctx) => ({
        members: await ctx.db
          .query("groupMembers")
          .withIndex("by_group_id", (q) => q.eq("groupId", f.group))
          .take(10),
        audits: await ctx.db.query("systemAdminAuditLogs").take(20),
        notifications: await ctx.db.query("systemAdminNotifications").take(20),
      }));
    const initial = await snapshot();

    await t.run(async (ctx) => await ctx.db.patch(f.group, { status: "archived" }));
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: f.group,
          targetUserId: f.target,
          newRole: "owner",
          reason: "inactive group",
        }),
    ).rejects.toThrow("active状態");
    expect(await snapshot()).toEqual(initial);

    await t.run(async (ctx) => await ctx.db.patch(f.group, { status: "active" }));
    const outsider = await t.run(
      async (ctx) =>
        await ctx.db.insert("users", {
          userId: "outsider",
          displayName: "Outsider",
          createdAt: 1,
          updatedAt: 1,
        }),
    );
    const afterGroupRestore = await snapshot();
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: f.group,
          targetUserId: outsider,
          newRole: "owner",
          reason: "非member",
        }),
    ).rejects.toThrow("memberではありません");
    expect(await snapshot()).toEqual(afterGroupRestore);

    await t.run(
      async (ctx) =>
        await ctx.db.insert("accountDeletionRequests", {
          userId: "target",
          clerkUserId: "target",
          status: "requested",
          leftGroupCount: 0,
          deletedGroupCount: 0,
          attemptCount: 0,
          maxAttempts: 3,
          createdAt: 1,
          updatedAt: 1,
        }),
    );
    const beforeTargetDeletion = await snapshot();
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "change_role",
          groupId: f.group,
          targetUserId: f.target,
          newRole: "owner",
          reason: "削除中",
        }),
    ).rejects.toThrow("アカウント削除処理中");
    expect(await snapshot()).toEqual(beforeTargetDeletion);
  });

  it("owner付替え元が削除処理中なら状態を変更しない", async () => {
    const t = convexTest(schema, convexTestModules);
    const f = await seed(t, 2);
    await t.run(
      async (ctx) =>
        await ctx.db.insert("accountDeletionRequests", {
          userId: "owner",
          clerkUserId: "owner",
          status: "requested",
          leftGroupCount: 0,
          deletedGroupCount: 0,
          attemptCount: 0,
          maxAttempts: 3,
          createdAt: 1,
          updatedAt: 1,
        }),
    );
    const before = await t.run(async (ctx) => ({
      members: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", f.group))
        .take(10),
      audits: await ctx.db.query("systemAdminAuditLogs").take(20),
      notifications: await ctx.db.query("systemAdminNotifications").take(20),
    }));
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(api.systemAdminRoleOperations.systemAdminRoleOperation, {
          operation: "transfer_owner",
          groupId: f.group,
          sourceOwnerUserId: f.owner,
          targetUserId: f.target,
          reason: "削除中のowner",
        }),
    ).rejects.toThrow("アカウント削除処理中");
    const after = await t.run(async (ctx) => ({
      members: await ctx.db
        .query("groupMembers")
        .withIndex("by_group_id", (q) => q.eq("groupId", f.group))
        .take(10),
      audits: await ctx.db.query("systemAdminAuditLogs").take(20),
      notifications: await ctx.db.query("systemAdminNotifications").take(20),
    }));
    expect(after).toEqual(before);
  });
});

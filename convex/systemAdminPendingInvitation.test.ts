// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { convexTestModules } from "./test.setup";

const identity = (userId: string) => ({
  tokenIdentifier: userId,
  subject: `clerk-${userId}`,
  issuer: "https://issuer.example",
});

async function seed(t: ReturnType<typeof convexTest>) {
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
      email: "owner@example.test",
      createdAt: 1,
      updatedAt: 1,
    });
    const group = await ctx.db.insert("groups", {
      name: "Invite Group",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const invitation = await ctx.db.insert("groupInvitations", {
      groupId: group,
      email: "invitee@example.test",
      token: "do-not-leak-token",
      status: "pending",
      invitedByUserId: "owner",
      clerkInvitationId: "clerk-invite-1",
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
      userId: "owner",
      role: "owner",
      createdAt: 1,
      updatedAt: 1,
    });
    return { admin, owner, group, invitation };
  });
}

describe("system admin pending invitation revoke", () => {
  it("pending招待だけをrevokedへ更新し監査・owner/email通知を作る", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t);
    await t
      .withIdentity(identity("admin"))
      .mutation(internal.systemAdminPendingInvitation.completePendingInvitation, {
        groupId: fixture.group,
        invitationId: fixture.invitation,
        reason: "誤招待の取消",
        expectedClerkInvitationId: "clerk-invite-1",
      });

    const result = await t.run(async (ctx) => ({
      invitation: await ctx.db.get(fixture.invitation),
      audit: await ctx.db.query("systemAdminAuditLogs").take(10),
      notifications: await ctx.db.query("systemAdminNotifications").take(10),
      groups: await ctx.db.query("groups").take(10),
      members: await ctx.db.query("groupMembers").take(10),
    }));
    expect(result.invitation?.status).toBe("revoked");
    expect(result.audit[0]).toMatchObject({
      action: "system_admin_group_invitation_revoked",
      targetId: fixture.invitation,
      targetDisplayNameSnapshot: "invitee@example.test",
      sourceGroupId: fixture.group,
      reason: "誤招待の取消",
      result: "success",
    });
    expect(result.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientUserId: fixture.owner }),
        expect.objectContaining({ recipientEmail: "invitee@example.test" }),
      ]),
    );
    expect(JSON.stringify(result.audit)).not.toContain("do-not-leak-token");
    expect(JSON.stringify(result.notifications)).not.toContain("clerk-invite-1");
    expect(result.groups).toHaveLength(1);
    expect(result.members).toHaveLength(1);
  });

  it("非admin・他group・非pending・存在しない招待を拒否する", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t);
    const otherGroup = await t.run(
      async (ctx) =>
        await ctx.db.insert("groups", {
          name: "Other",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        }),
    );
    await expect(
      t
        .withIdentity(identity("none"))
        .mutation(internal.systemAdminPendingInvitation.completePendingInvitation, {
          groupId: fixture.group,
          invitationId: fixture.invitation,
          reason: "拒否",
          expectedClerkInvitationId: "clerk-invite-1",
        }),
    ).rejects.toThrow("システム管理者権限が必要です");
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(internal.systemAdminPendingInvitation.completePendingInvitation, {
          groupId: otherGroup,
          invitationId: fixture.invitation,
          reason: "別group",
          expectedClerkInvitationId: "clerk-invite-1",
        }),
    ).rejects.toThrow("group");
    await t.run(async (ctx) => ctx.db.patch(fixture.invitation, { status: "accepted" }));
    await expect(
      t
        .withIdentity(identity("admin"))
        .mutation(internal.systemAdminPendingInvitation.completePendingInvitation, {
          groupId: fixture.group,
          invitationId: fixture.invitation,
          reason: "accepted",
          expectedClerkInvitationId: "clerk-invite-1",
        }),
    ).rejects.toThrow("pending");
  });

  it("Clerk取消失敗を記録しConvex状態を変更しない", async () => {
    const t = convexTest(schema, convexTestModules);
    const fixture = await seed(t);
    await t
      .withIdentity(identity("admin"))
      .mutation(internal.systemAdminPendingInvitation.recordRevokeFailure, {
        groupId: fixture.group,
        invitationId: fixture.invitation,
        reason: "Clerk取消失敗",
      });
    const result = await t.run(async (ctx) => ({
      invitation: await ctx.db.get(fixture.invitation),
      audit: await ctx.db.query("systemAdminAuditLogs").take(10),
    }));
    expect(result.invitation?.status).toBe("pending");
    expect(result.audit[0]).toMatchObject({
      action: "system_admin_group_invitation_revoked",
      result: "denied",
      reason: "Clerk取消失敗",
    });
  });
});

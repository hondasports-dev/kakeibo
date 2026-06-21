/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const originalAppEnvironment = process.env.APP_ENV;

beforeEach(() => {
  process.env.APP_ENV = "development";
});

afterAll(() => {
  process.env.APP_ENV = originalAppEnvironment;
});

type PaginationOpts = { numItems: number; cursor: string | null };
type SearchUsersArgs = {
  queryType: "displayName" | "email" | "userId";
  query: string;
  paginationOpts: PaginationOpts;
};
type SearchGroupsArgs = {
  queryType: "name" | "groupId";
  query: string;
  paginationOpts: PaginationOpts;
};

const searchUsers = makeFunctionReference<"action", SearchUsersArgs, SearchResponse<UserListItem>>(
  "systemAdmin/actions:searchUsers",
);
const searchGroups = makeFunctionReference<
  "action",
  SearchGroupsArgs,
  SearchResponse<GroupListItem>
>("systemAdmin/actions:searchGroups");
const getUserDetail = makeFunctionReference<"action", { userId: Id<"users"> }, UserDetail | null>(
  "systemAdmin/actions:getUserDetail",
);
const getGroupDetail = makeFunctionReference<
  "action",
  { groupId: Id<"groups"> },
  GroupDetail | null
>("systemAdmin/actions:getGroupDetail");
const bootstrapSystemAdmin = makeFunctionReference<
  "mutation",
  {
    targetUserId: Id<"users">;
    reason: string;
    expectedEnvironment: "development" | "preview" | "production";
  },
  Id<"systemAdmins">
>("systemAdmin/internal:bootstrapSystemAdmin");

type SearchResponse<T> = {
  environment: "development" | "preview" | "production";
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

type UserListItem = {
  id: Id<"users">;
  clerkUserId: string;
  displayName: string;
  email: string | null;
  activeGroupId: Id<"groups"> | null;
  createdAt: number;
  updatedAt: number;
};

type GroupListItem = {
  id: Id<"groups">;
  name: string;
  status: "active" | "deleted" | "archived";
  createdAt: number;
  updatedAt: number;
};

type UserDetail = UserListItem & {
  environment: "development" | "preview" | "production";
  memberships: Array<{
    groupId: Id<"groups">;
    groupName: string;
    role: "owner" | "member";
    createdAt: number;
    updatedAt: number;
  }>;
  invitations: Array<{
    id: Id<"groupInvitations">;
    groupId: Id<"groups">;
    groupName: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    createdAt: number;
    updatedAt: number;
  }>;
  membershipsTruncated: boolean;
  invitationsTruncated: boolean;
};

type GroupDetail = GroupListItem & {
  environment: "development" | "preview" | "production";
  members: Array<{
    userId: Id<"users"> | null;
    clerkUserId: string;
    displayName: string | null;
    email: string | null;
    role: "owner" | "member";
    createdAt: number;
    updatedAt: number;
  }>;
  invitations: Array<{
    id: Id<"groupInvitations">;
    email: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    createdAt: number;
    updatedAt: number;
  }>;
  membersTruncated: boolean;
  invitationsTruncated: boolean;
};

async function seedSystemAdminScenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminUserId = await ctx.db.insert("users", {
      userId: "https://issuer.example|admin",
      displayName: "システム管理者",
      email: "admin@example.com",
      createdAt: 1,
      updatedAt: 1,
    });
    const targetUserId = await ctx.db.insert("users", {
      userId: "https://issuer.example|target",
      displayName: "山田 花子",
      email: "hanako@example.com",
      createdAt: 2,
      updatedAt: 3,
    });
    const secondUserId = await ctx.db.insert("users", {
      userId: "https://issuer.example|second",
      displayName: "山田 太郎",
      email: "taro@example.com",
      createdAt: 3,
      updatedAt: 4,
    });
    const groupId = await ctx.db.insert("groups", {
      name: "山田家",
      status: "active",
      createdAt: 4,
      updatedAt: 5,
    });
    await ctx.db.patch(targetUserId, { activeGroupId: groupId });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: "https://issuer.example|target",
      role: "owner",
      createdAt: 5,
      updatedAt: 6,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: "https://issuer.example|second",
      role: "member",
      createdAt: 6,
      updatedAt: 7,
    });
    await ctx.db.insert("groupInvitations", {
      groupId,
      email: "hanako@example.com",
      token: "secret-token-must-not-leak",
      status: "accepted",
      invitedByUserId: "https://issuer.example|target",
      acceptedByUserId: "https://issuer.example|target",
      acceptedAt: 7,
      createdAt: 7,
      updatedAt: 8,
    });
    await ctx.db.insert("systemAdmins", {
      userId: adminUserId,
      status: "active",
      createdAt: 8,
      updatedAt: 8,
      grantedAt: 8,
      grantReason: "テスト管理者",
    });
    return { adminUserId, targetUserId, secondUserId, groupId };
  });

  const admin = t.withIdentity({ tokenIdentifier: "https://issuer.example|admin" });
  const target = t.withIdentity({ tokenIdentifier: "https://issuer.example|target" });
  return { t, admin, target, ...ids };
}

describe("system admin schema", () => {
  it("system admin と専用監査ログを保存できる", async () => {
    expect(schema.tables).toHaveProperty("systemAdmins");
    expect(schema.tables).toHaveProperty("systemAdminAuditLogs");

    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "https://issuer.example|admin",
        displayName: "管理者",
        email: "admin@example.com",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.run(async (ctx) => {
      const db = ctx.db as unknown as {
        insert(table: string, value: Record<string, unknown>): Promise<string>;
      };
      await db.insert("systemAdmins", {
        userId,
        status: "active",
        createdAt: 2,
        updatedAt: 2,
        grantedAt: 2,
        grantReason: "初期管理者",
      });
      await db.insert("systemAdminAuditLogs", {
        action: "system_admin_bootstrapped",
        actorType: "system",
        targetKind: "system_admin",
        targetUserId: userId,
        reason: "初期管理者",
        newStatus: "active",
        createdAt: 2,
      });
    });

    const result = await t.run(async (ctx) => {
      const db = ctx.db as unknown as {
        query(table: string): { collect(): Promise<Array<Record<string, unknown>>> };
      };
      return {
        admins: await db.query("systemAdmins").collect(),
        auditLogs: await db.query("systemAdminAuditLogs").collect(),
      };
    });

    expect(result.admins).toHaveLength(1);
    expect(result.auditLogs).toHaveLength(1);
  });
});

describe("system admin search API", () => {
  it("active system admin だけがユーザーをページネーション検索でき、検索語を残さない", async () => {
    const { t, admin } = await seedSystemAdminScenario();

    const firstPage = await admin.action(searchUsers, {
      queryType: "displayName",
      query: "山田",
      paginationOpts: { numItems: 1, cursor: null },
    });

    expect(firstPage.environment).toBe("development");
    expect(firstPage.page).toHaveLength(1);
    expect(Object.keys(firstPage.page[0] ?? {}).sort()).toEqual(
      [
        "activeGroupId",
        "clerkUserId",
        "createdAt",
        "displayName",
        "email",
        "id",
        "updatedAt",
      ].sort(),
    );
    expect(firstPage.isDone).toBe(false);

    const secondPage = await admin.action(searchUsers, {
      queryType: "displayName",
      query: "山田",
      paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
    });
    expect(secondPage.page).toHaveLength(1);
    expect(secondPage.isDone).toBe(true);

    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemAdminAuditLogs").collect();
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      action: "system_admin_user_searched",
      actorType: "system_admin",
      queryType: "user_display_name",
      resultCount: 1,
    });
    expect(logs[0]?.queryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(logs)).not.toContain("山田");
  });

  it("非管理者と revoked admin は検索できない", async () => {
    const { t, target, adminUserId, admin } = await seedSystemAdminScenario();

    await expect(
      target.action(searchUsers, {
        queryType: "email",
        query: "hanako",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("システム管理者権限が必要です");

    await t.run(async (ctx) => {
      const record = await ctx.db
        .query("systemAdmins")
        .withIndex("by_user_id", (q) => q.eq("userId", adminUserId))
        .unique();
      if (record !== null) {
        await ctx.db.patch(record._id, {
          status: "revoked",
          revokedAt: 9,
          revokeReason: "テスト",
        });
      }
    });

    await expect(
      admin.action(searchUsers, {
        queryType: "email",
        query: "hanako",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("システム管理者権限が必要です");
  });

  it("APP_ENVが未知の値なら環境を誤表示せず拒否する", async () => {
    const { admin } = await seedSystemAdminScenario();
    process.env.APP_ENV = "unexpected";

    await expect(
      admin.action(searchUsers, {
        queryType: "email",
        query: "hanako",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("APP_ENVが正しく設定されていません");
  });

  it("ユーザーIDとグループ名・グループIDで検索できる", async () => {
    const { admin, targetUserId, groupId } = await seedSystemAdminScenario();

    const users = await admin.action(searchUsers, {
      queryType: "userId",
      query: "https://issuer.example|target",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(users.page.map((user) => user.id)).toEqual([targetUserId]);

    const groupsByName = await admin.action(searchGroups, {
      queryType: "name",
      query: "山田家",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(groupsByName.page.map((group) => group.id)).toEqual([groupId]);

    const groupsById = await admin.action(searchGroups, {
      queryType: "groupId",
      query: groupId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(groupsById.page.map((group) => group.id)).toEqual([groupId]);
  });

  it("ユーザー詳細は所属・招待だけを返し閲覧を監査する", async () => {
    const { t, admin, targetUserId, groupId } = await seedSystemAdminScenario();

    const detail = await admin.action(getUserDetail, { userId: targetUserId });

    expect(detail).not.toBeNull();
    expect(detail?.memberships).toEqual([
      expect.objectContaining({ groupId, groupName: "山田家", role: "owner" }),
    ]);
    expect(detail?.invitations).toEqual([
      expect.objectContaining({ groupId, groupName: "山田家", status: "accepted" }),
    ]);
    expect(JSON.stringify(detail)).not.toContain("secret-token-must-not-leak");

    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemAdminAuditLogs").collect();
    });
    expect(logs).toEqual([
      expect.objectContaining({
        action: "system_admin_user_viewed",
        targetKind: "user",
        targetId: targetUserId,
      }),
    ]);
  });

  it("グループ詳細はメンバー・招待だけを返し閲覧を監査する", async () => {
    const { t, admin, groupId } = await seedSystemAdminScenario();

    const detail = await admin.action(getGroupDetail, { groupId });

    expect(detail).not.toBeNull();
    expect(detail?.members).toHaveLength(2);
    expect(detail?.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: "山田 花子", role: "owner" }),
        expect.objectContaining({ displayName: "山田 太郎", role: "member" }),
      ]),
    );
    expect(detail?.invitations).toEqual([
      expect.objectContaining({ email: "hanako@example.com", status: "accepted" }),
    ]);
    expect(JSON.stringify(detail)).not.toContain("secret-token-must-not-leak");

    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemAdminAuditLogs").collect();
    });
    expect(logs).toEqual([
      expect.objectContaining({
        action: "system_admin_group_viewed",
        targetKind: "group",
        targetId: groupId,
      }),
    ]);
  });
});

describe("system admin bootstrap", () => {
  it("対象環境で最初のactive adminと監査ログを同時に作成する", async () => {
    const previousEnvironment = process.env.APP_ENV;
    process.env.APP_ENV = "development";
    try {
      const t = convexTest(schema, modules);
      const targetUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          userId: "https://issuer.example|bootstrap",
          displayName: "初期管理者",
          createdAt: 1,
          updatedAt: 1,
        });
      });

      const systemAdminId = await t.mutation(bootstrapSystemAdmin, {
        targetUserId,
        reason: "初期運用担当者",
        expectedEnvironment: "development",
      });

      const result = await t.run(async (ctx) => ({
        systemAdmin: await ctx.db.get(systemAdminId),
        auditLogs: await ctx.db.query("systemAdminAuditLogs").collect(),
      }));
      expect(result.systemAdmin).toMatchObject({
        userId: targetUserId,
        status: "active",
        grantReason: "初期運用担当者",
      });
      expect(result.auditLogs).toEqual([
        expect.objectContaining({
          action: "system_admin_bootstrapped",
          actorType: "system",
          targetUserId,
          reason: "初期運用担当者",
        }),
      ]);
    } finally {
      process.env.APP_ENV = previousEnvironment;
    }
  });

  it("環境不一致と2人目のbootstrapを拒否する", async () => {
    const previousEnvironment = process.env.APP_ENV;
    process.env.APP_ENV = "development";
    try {
      const t = convexTest(schema, modules);
      const [firstUserId, secondUserId] = await t.run(async (ctx) => {
        const first = await ctx.db.insert("users", {
          userId: "https://issuer.example|first",
          displayName: "1人目",
          createdAt: 1,
          updatedAt: 1,
        });
        const second = await ctx.db.insert("users", {
          userId: "https://issuer.example|second-admin",
          displayName: "2人目",
          createdAt: 2,
          updatedAt: 2,
        });
        return [first, second] as const;
      });

      await expect(
        t.mutation(bootstrapSystemAdmin, {
          targetUserId: firstUserId,
          reason: "環境違い",
          expectedEnvironment: "production",
        }),
      ).rejects.toThrow("対象環境とAPP_ENVが一致しません");

      await t.mutation(bootstrapSystemAdmin, {
        targetUserId: firstUserId,
        reason: "初期運用担当者",
        expectedEnvironment: "development",
      });
      await expect(
        t.mutation(bootstrapSystemAdmin, {
          targetUserId: secondUserId,
          reason: "2人目",
          expectedEnvironment: "development",
        }),
      ).rejects.toThrow("初期管理者は登録済みです");
    } finally {
      process.env.APP_ENV = previousEnvironment;
    }
  });
});

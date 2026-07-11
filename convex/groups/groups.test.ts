import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as groupAdminGuards from "./adminGuards";
import { GROUP_ADMIN_ERRORS } from "./adminGuards";
import * as deleteGroupPhysically from "./lib/deleteGroupPhysically";
import {
  acceptGroupInvitationForVerifiedEmailsHandler,
  acceptGroupInvitationHandler,
  assertEmailCanBeInvitedToGroupHandler,
  createGroupInvitationRecordHandler,
  deletePendingGroupInvitationRecordByTokenHandler,
  dedupePendingGroupInvitationsByEmail,
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  cancelPendingGroupInvitationHandler,
} from "./invitations";
import { deleteGroupHandler } from "./deletion";
import { seedGroupMemberForE2eHandler } from "./e2e";
import { sortGroupMembersForDisplay } from "./memberDisplay";
import { getGroupMembership } from "./membership";
import {
  addMemberByEmailHandler,
  changeMemberRoleHandler,
  removeMemberHandler,
  transferGroupOwnershipHandler,
} from "./members";
import { createGroupHandler, setActiveGroupHandler, updateGroupNameHandler } from "./mutations";
import {
  getGroupMembersHandler,
  listMyGroupsHandler,
  listPendingGroupInvitationsHandler,
} from "./queries";

type GroupDoc = {
  _id: Id<"groups">;
  name: string;
  clerkOrganizationId?: string;
  status?: "active" | "deleted" | "archived";
  deletedAt?: number;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type UserDoc = {
  _id: Id<"users">;
  userId: string;
  displayName: string;
  email?: string;
  activeGroupId?: Id<"groups">;
  createdAt: number;
  updatedAt: number;
};

type GroupMemberDoc = {
  _id: Id<"groupMembers">;
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
  createdAt: number;
  updatedAt: number;
};

type GroupInvitationDoc = {
  _id: Id<"groupInvitations">;
  groupId: Id<"groups">;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedByUserId: string;
  clerkInvitationId?: string;
  acceptedByUserId?: string;
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;
};

function createIdentity(userId: string, email = "owner@example.com"): UserIdentity {
  return {
    tokenIdentifier: userId,
    subject: userId,
    issuer: "https://issuer.example",
    email,
  };
}

function createMockDb(state: {
  groups?: GroupDoc[];
  users?: UserDoc[];
  groupMembers?: GroupMemberDoc[];
  groupInvitations?: GroupInvitationDoc[];
}) {
  const groups = [...(state.groups ?? [])];
  const users = [...(state.users ?? [])];
  const groupMembers = [...(state.groupMembers ?? [])];
  const groupInvitations = [...(state.groupInvitations ?? [])];

  const groupIds = new Set<Id<"groups">>([
    ...groupMembers.map((m) => m.groupId),
    ...groupInvitations.map((i) => i.groupId),
  ]);
  for (const groupId of groupIds) {
    if (!groups.some((g) => g._id === groupId)) {
      groups.push({
        _id: groupId,
        name: "Test Group",
        createdAt: 1000,
        updatedAt: 1000,
      });
    }
  }

  const insert = vi.fn(async (tableName: string, doc: Record<string, unknown>) => {
    const id = `${tableName}-${insert.mock.calls.length}` as Id<
      | "groups"
      | "users"
      | "groupMembers"
      | "groupInvitations"
      | "managementAuditLogs"
      | "transactionalEmailJobs"
    >;
    const created = { _id: id, _creationTime: Date.now(), ...doc } as never;
    if (tableName === "groups") groups.push(created as GroupDoc);
    if (tableName === "users") users.push(created as UserDoc);
    if (tableName === "groupMembers") groupMembers.push(created as GroupMemberDoc);
    if (tableName === "groupInvitations") groupInvitations.push(created as GroupInvitationDoc);
    return id;
  });

  const patch = vi.fn(async (id: string, patchDoc: Record<string, unknown>) => {
    const allDocs = [groups, users, groupMembers, groupInvitations];
    for (const docs of allDocs) {
      const doc = docs.find((item) => item._id === id);
      if (doc) {
        Object.assign(doc, patchDoc);
        return;
      }
    }
  });

  const remove = vi.fn(async (id: string) => {
    const docs = [groups, users, groupMembers, groupInvitations];
    for (const list of docs) {
      const index = list.findIndex((item) => item._id === id);
      if (index >= 0) {
        list.splice(index, 1);
        return;
      }
    }
  });

  const get = vi.fn(async (id: string) => {
    return (
      [...groups, ...users, ...groupMembers, ...groupInvitations].find((doc) => doc._id === id) ??
      null
    );
  });

  const query = vi.fn((tableName: string) => ({
    withIndex: vi.fn((indexName: string, builder: (q: unknown) => unknown) => {
      const filters: Record<string, unknown> = {};
      const q = {
        eq: vi.fn((field: string, value: unknown) => {
          filters[field] = value;
          return q;
        }),
      };
      builder(q);

      const isSupportedIndex = () => {
        if (indexName.startsWith("by_group_id")) {
          return true;
        }
        if (tableName === "users") {
          return indexName === "by_token_identifier" || indexName === "by_email";
        }
        if (tableName === "groupMembers") {
          return (
            indexName === "by_user_id" ||
            indexName === "by_group_id" ||
            indexName === "by_group_id_and_user_id"
          );
        }
        if (tableName === "groupInvitations") {
          return (
            indexName === "by_token" ||
            indexName === "by_group_id_and_email" ||
            indexName === "by_group_id_and_status"
          );
        }
        return false;
      };

      if (!isSupportedIndex()) {
        throw new Error(`Unsupported mock index: ${tableName}.${indexName}`);
      }

      const filterDocs = () => {
        const source =
          tableName === "groups"
            ? groups
            : tableName === "users"
              ? users
              : tableName === "groupMembers"
                ? groupMembers
                : tableName === "groupInvitations"
                  ? groupInvitations
                  : [];

        return source.filter((doc) => {
          if (indexName.startsWith("by_group_id") && "groupId" in doc) {
            if (doc.groupId !== filters.groupId) {
              return false;
            }
            if ("userId" in filters && "userId" in doc && doc.userId !== filters.userId) {
              return false;
            }
            if ("email" in filters && "email" in doc && doc.email !== filters.email) {
              return false;
            }
            if ("status" in filters && "status" in doc && doc.status !== filters.status) {
              return false;
            }
            return true;
          }
          if (indexName === "by_token_identifier" && "userId" in doc) {
            return doc.userId === filters.userId;
          }
          if (indexName === "by_email" && "email" in doc) {
            return doc.email === filters.email;
          }
          if (indexName === "by_user_id" && "userId" in doc) {
            return doc.userId === filters.userId;
          }
          if (indexName === "by_token" && "token" in doc) {
            return doc.token === filters.token;
          }
          return false;
        });
      };

      const docs = filterDocs();
      return {
        collect: vi.fn(async () => docs),
        unique: vi.fn(async () => {
          if (docs.length > 1) {
            throw new Error(`Mock unique() received ${docs.length} documents`);
          }
          return docs[0] ?? null;
        }),
        take: vi.fn(async (count?: number) =>
          typeof count === "number" ? docs.slice(0, count) : docs,
        ),
      };
    }),
  }));

  return {
    auth: {
      getUserIdentity: vi.fn(),
    },
    storage: {
      delete: vi.fn(async () => undefined),
    },
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
    db: {
      get,
      insert,
      patch,
      delete: remove,
      query,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx & QueryCtx;
}

describe("groups", () => {
  it("invitationEmailsMatch は Gmail の plus tag とドット違いを同一メールボックスとして扱う", () => {
    expect(invitationEmailsMatch("invitee@gmail.com", "in.vi.tee+family@gmail.com")).toBe(true);
    expect(invitationEmailsMatch("invitee@googlemail.com", "in.vi.tee+family@gmail.com")).toBe(
      true,
    );
    expect(invitationEmailsMatch("invitee@example.com", "invitee+family@example.com")).toBe(false);
  });

  it("invitationEmailsMatchAny は Clerk の検証済みメール候補も照合する", () => {
    expect(
      invitationEmailsMatchAny(
        ["primary@example.com", "in.vi.tee+family@gmail.com"],
        "invitee@gmail.com",
      ),
    ).toBe(true);
    expect(invitationEmailsMatchAny(["primary@example.com"], "invitee@example.com")).toBe(false);
  });

  it("sortGroupMembersForDisplay は owner を先頭にし、member を表示名順に並べる", () => {
    expect(
      sortGroupMembersForDisplay([
        {
          userId: "member-b",
          role: "member",
          displayName: "メンバーB",
          email: "b@example.com",
          isActiveGroup: false,
          createdAt: 2000,
        },
        {
          userId: "owner",
          role: "owner",
          displayName: "オーナー",
          email: "owner@example.com",
          isActiveGroup: true,
          createdAt: 1000,
        },
        {
          userId: "member-a",
          role: "member",
          displayName: "メンバーA",
          email: "a@example.com",
          isActiveGroup: false,
          createdAt: 3000,
        },
      ]),
    ).toEqual([
      {
        userId: "owner",
        role: "owner",
        displayName: "オーナー",
        email: "owner@example.com",
        isActiveGroup: true,
        createdAt: 1000,
      },
      {
        userId: "member-a",
        role: "member",
        displayName: "メンバーA",
        email: "a@example.com",
        isActiveGroup: false,
        createdAt: 3000,
      },
      {
        userId: "member-b",
        role: "member",
        displayName: "メンバーB",
        email: "b@example.com",
        isActiveGroup: false,
        createdAt: 2000,
      },
    ]);
  });

  it("getGroupMembership は activeGroupId が複数所属でも現在のグループを返す", async () => {
    const userId = "https://issuer.example|user-001";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-001" as Id<"users">,
          userId,
          displayName: "ユーザー",
          activeGroupId: "group-002" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-001" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-002" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(getGroupMembership(ctx)).resolves.toEqual({
      membershipId: "member-002",
      groupId: "group-002",
      userId,
      role: "owner",
    });
  });

  it("getGroupMembership は複数所属で activeGroupId がなければ null を返す", async () => {
    const userId = "https://issuer.example|user-002";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-002" as Id<"users">,
          userId,
          displayName: "ユーザー",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-003" as Id<"groupMembers">,
          groupId: "group-003" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-004" as Id<"groupMembers">,
          groupId: "group-004" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(getGroupMembership(ctx)).resolves.toBeNull();
  });

  it("getGroupMembership は削除済み activeGroupId のグループを返さない", async () => {
    const userId = "https://issuer.example|user-deleted-active";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-deleted-active" as Id<"users">,
          userId,
          displayName: "ユーザー",
          activeGroupId: "group-deleted" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-deleted" as Id<"groups">,
          name: "削除済み",
          status: "deleted",
          deletedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      groupMembers: [
        {
          _id: "member-deleted" as Id<"groupMembers">,
          groupId: "group-deleted" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(getGroupMembership(ctx)).resolves.toBeNull();
  });

  it("createGroupHandler は既存の所属があっても新しいグループを作り、activeGroupId を更新する", async () => {
    const userId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー",
          activeGroupId: "group-old" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-old" as Id<"groupMembers">,
          groupId: "group-old" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    const groupId = await createGroupHandler(ctx, { name: "佐藤家" });

    expect(groupId).toMatch(/^groups-/);
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "groupMembers",
      expect.objectContaining({
        userId,
        role: "owner",
      }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-owner",
      expect.objectContaining({
        activeGroupId: groupId,
      }),
    );
  });

  it("createGroupHandler は空文字を拒否する", async () => {
    const userId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(createGroupHandler(ctx, { name: "   " })).rejects.toThrow(
      "グループ名を入力してください",
    );
  });

  it("createGroupHandler は長すぎる名前を拒否する", async () => {
    const userId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(createGroupHandler(ctx, { name: "あ".repeat(51) })).rejects.toThrow(
      "グループ名は50文字以内で入力してください",
    );
  });

  it("listMyGroupsHandler は現在の activeGroup を isActive 付きで返す", async () => {
    const userId = "https://issuer.example|user-003";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-003" as Id<"users">,
          userId,
          displayName: "ユーザー",
          activeGroupId: "group-002" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "group-002" as Id<"groups">,
          name: "鈴木家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-005" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-006" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(listMyGroupsHandler(ctx)).resolves.toEqual([
      {
        _id: "group-001",
        name: "佐藤家",
        clerkOrganizationId: null,
        role: "member",
        createdAt: 1000,
        isActive: false,
      },
      {
        _id: "group-002",
        name: "鈴木家",
        clerkOrganizationId: null,
        role: "owner",
        createdAt: 1000,
        isActive: true,
      },
    ]);
  });

  it("getGroupMembersHandler は active group のメンバーだけを owner 優先で返す", async () => {
    const userId = "https://issuer.example|owner-user";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー太郎",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member-a" as Id<"users">,
          userId: "https://issuer.example|member-a",
          displayName: "メンバーA",
          email: "member-a@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member-b" as Id<"users">,
          userId: "https://issuer.example|member-b",
          displayName: "メンバーB",
          email: "member-b@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "group-002" as Id<"groups">,
          name: "鈴木家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-b" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: "https://issuer.example|member-b",
          role: "member",
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          _id: "member-a" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: "https://issuer.example|member-a",
          role: "member",
          createdAt: 3000,
          updatedAt: 3000,
        },
        {
          _id: "member-other-group" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: "https://issuer.example|other-group-member",
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(getGroupMembersHandler(ctx)).resolves.toEqual([
      {
        userId,
        role: "owner",
        displayName: "オーナー太郎",
        email: "owner@example.com",
        isActiveGroup: true,
        createdAt: 1000,
      },
      {
        userId: "https://issuer.example|member-a",
        role: "member",
        displayName: "メンバーA",
        email: "member-a@example.com",
        isActiveGroup: false,
        createdAt: 3000,
      },
      {
        userId: "https://issuer.example|member-b",
        role: "member",
        displayName: "メンバーB",
        email: "member-b@example.com",
        isActiveGroup: false,
        createdAt: 2000,
      },
    ]);
  });

  it("getGroupMembersHandler はグループ未所属ならエラーになる", async () => {
    const userId = "https://issuer.example|lonely-user";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-lonely" as Id<"users">,
          userId,
          displayName: "ユーザー",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(getGroupMembersHandler(ctx)).rejects.toThrow("グループに所属していません");
  });

  it("listPendingGroupInvitationsHandler は active group の pending 招待だけを新しい順で返す", async () => {
    const userId = "https://issuer.example|owner-user";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー太郎",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-old" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "old@example.com",
          token: "old-token",
          status: "pending",
          invitedByUserId: userId,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-new" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "new@example.com",
          token: "new-token",
          status: "pending",
          invitedByUserId: userId,
          createdAt: 3000,
          updatedAt: 3000,
        },
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "accepted@example.com",
          token: "accepted-token",
          status: "accepted",
          invitedByUserId: userId,
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          _id: "invite-other-group" as Id<"groupInvitations">,
          groupId: "group-002" as Id<"groups">,
          email: "other@example.com",
          token: "other-token",
          status: "pending",
          invitedByUserId: userId,
          createdAt: 4000,
          updatedAt: 4000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(listPendingGroupInvitationsHandler(ctx)).resolves.toEqual([
      {
        _id: "invite-new",
        email: "new@example.com",
        status: "pending",
        createdAt: 3000,
      },
      {
        _id: "invite-old",
        email: "old@example.com",
        status: "pending",
        createdAt: 1000,
      },
    ]);
  });

  it("listPendingGroupInvitationsHandler は同一メールの pending を最新 1 件にまとめる", async () => {
    const userId = "https://issuer.example|owner-user";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId,
          displayName: "オーナー太郎",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-old-dup" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "dup@example.com",
          token: "old-dup-token",
          status: "pending",
          invitedByUserId: userId,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-new-dup" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "dup@example.com",
          token: "new-dup-token",
          status: "pending",
          invitedByUserId: userId,
          createdAt: 3000,
          updatedAt: 3000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(listPendingGroupInvitationsHandler(ctx)).resolves.toEqual([
      {
        _id: "invite-new-dup",
        email: "dup@example.com",
        status: "pending",
        createdAt: 3000,
      },
    ]);
  });

  it("dedupePendingGroupInvitationsByEmail は Gmail alias を同一メールとしてまとめる", () => {
    const invitations = dedupePendingGroupInvitationsByEmail([
      {
        _id: "invite-alias-old" as Id<"groupInvitations">,
        email: "a.b.c@gmail.com",
        status: "pending",
        createdAt: 1000,
      },
      {
        _id: "invite-alias-new" as Id<"groupInvitations">,
        email: "abc@gmail.com",
        status: "pending",
        createdAt: 2000,
      },
    ]);

    expect(invitations).toEqual([
      {
        _id: "invite-alias-new",
        email: "abc@gmail.com",
        status: "pending",
        createdAt: 2000,
      },
    ]);
    expect(getInvitationEmailKey("a.b.c@gmail.com")).toBe(getInvitationEmailKey("abc@gmail.com"));
  });

  it("listPendingGroupInvitationsHandler は member から呼ぶと拒否する", async () => {
    const userId = "https://issuer.example|member-user";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-user" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(userId, "member@example.com"));

    await expect(listPendingGroupInvitationsHandler(ctx)).rejects.toThrow(
      "グループオーナーのみ実行できます",
    );
  });

  it("setActiveGroupHandler は所属しているグループを active に切り替える", async () => {
    const userId = "https://issuer.example|user-004";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-004" as Id<"users">,
          userId,
          displayName: "ユーザー",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-007" as Id<"groupMembers">,
          groupId: "group-007" as Id<"groups">,
          userId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-007" as Id<"groups">,
          name: "切替先グループ",
          status: "active",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(userId));

    await expect(
      setActiveGroupHandler(ctx, { groupId: "group-007" as Id<"groups"> }),
    ).resolves.toEqual("group-007");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-004",
      expect.objectContaining({ activeGroupId: "group-007" }),
    );
  });

  it("acceptGroupInvitationHandler は一致するメールだけを受け入れ、activeGroupId を更新する", async () => {
    const userId = "https://issuer.example|invitee";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-invitee" as Id<"users">,
          userId,
          displayName: "招待先",
          email: "invitee@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-100" as Id<"groups">,
          name: "招待元",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-001" as Id<"groupInvitations">,
          groupId: "group-100" as Id<"groups">,
          email: "invitee@example.com",
          token: "invite-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          clerkInvitationId: "clerk-invite-001",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(userId, "invitee@example.com"));

    await expect(acceptGroupInvitationHandler(ctx, { token: "invite-token" })).resolves.toEqual(
      "group-100",
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "groupMembers",
      expect.objectContaining({
        groupId: "group-100",
        userId,
        role: "member",
      }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-invitee",
      expect.objectContaining({ activeGroupId: "group-100" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-001",
      expect.objectContaining({ status: "accepted" }),
    );
  });

  it("acceptGroupInvitationHandler は受け入れ後に同一メールの他 pending を revoked にする", async () => {
    const userId = "https://issuer.example|invitee";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-invitee" as Id<"users">,
          userId,
          displayName: "招待先",
          email: "invitee@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-100" as Id<"groups">,
          name: "招待元",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-primary" as Id<"groupInvitations">,
          groupId: "group-100" as Id<"groups">,
          email: "invitee@example.com",
          token: "invite-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          clerkInvitationId: "clerk-invite-001",
          createdAt: 3000,
          updatedAt: 3000,
        },
        {
          _id: "invite-duplicate" as Id<"groupInvitations">,
          groupId: "group-100" as Id<"groups">,
          email: "invitee@example.com",
          token: "old-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(userId, "invitee@example.com"));

    await expect(acceptGroupInvitationHandler(ctx, { token: "invite-token" })).resolves.toEqual(
      "group-100",
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-duplicate",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-primary",
      expect.objectContaining({ status: "accepted" }),
    );
  });

  it("acceptGroupInvitationHandler はメール不一致なら拒否する", async () => {
    const userId = "https://issuer.example|invitee";
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-002" as Id<"groupInvitations">,
          groupId: "group-100" as Id<"groups">,
          email: "invitee@example.com",
          token: "invite-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(userId, "other@example.com"));

    await expect(acceptGroupInvitationHandler(ctx, { token: "invite-token" })).rejects.toThrow(
      ConvexError,
    );
  });

  it("acceptGroupInvitationForVerifiedEmailsHandler は検証済みメール候補が一致すれば受け入れる", async () => {
    const userId = "https://issuer.example|invitee";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-invitee" as Id<"users">,
          userId,
          displayName: "招待先",
          email: "primary@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-verified" as Id<"groupInvitations">,
          groupId: "group-verified" as Id<"groups">,
          email: "invitee@example.com",
          token: "invite-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      acceptGroupInvitationForVerifiedEmailsHandler(ctx, {
        token: "invite-token",
        acceptedUserId: userId,
        acceptedEmails: ["primary@example.com", "invitee@example.com"],
      }),
    ).resolves.toEqual("group-verified");
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "groupMembers",
      expect.objectContaining({
        groupId: "group-verified",
        userId,
        role: "member",
      }),
    );
  });

  it("acceptGroupInvitationForVerifiedEmailsHandler は検証済みメール候補が不一致なら拒否する", async () => {
    const userId = "https://issuer.example|invitee";
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-unmatched" as Id<"groupInvitations">,
          groupId: "group-unmatched" as Id<"groups">,
          email: "invitee@example.com",
          token: "invite-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      acceptGroupInvitationForVerifiedEmailsHandler(ctx, {
        token: "invite-token",
        acceptedUserId: userId,
        acceptedEmails: ["primary@example.com"],
      }),
    ).rejects.toThrow(ConvexError);
  });

  it("addMemberByEmailHandler は対象ユーザーが別グループ所属済みでも現在グループに追加できる", async () => {
    const ownerId = "https://issuer.example|owner";
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-002" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-existing" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      addMemberByEmailHandler(ctx, { email: "member@example.com" }),
    ).resolves.toBeUndefined();

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "groupMembers",
      expect.objectContaining({
        groupId: "group-001",
        userId: memberId,
        role: "member",
      }),
    );
    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      "user-member",
      expect.objectContaining({ activeGroupId: "group-001" }),
    );
  });

  it("assertEmailCanBeInvitedToGroupHandler は現在グループの既存メンバーを拒否する", async () => {
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: "https://issuer.example|member",
          displayName: "メンバー",
          email: "member@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-current" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: "https://issuer.example|member",
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: " MEMBER@example.com ",
      }),
    ).rejects.toThrow("このユーザーはすでにグループに参加しています");
  });

  it("assertEmailCanBeInvitedToGroupHandler は Gmail の dot / plus alias を同一メールボックスとして扱う", async () => {
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: "https://issuer.example|member",
          displayName: "メンバー",
          email: "family.budget+invite@gmail.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-current" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: "https://issuer.example|member",
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "familybudget@gmail.com",
      }),
    ).rejects.toThrow("このユーザーはすでにグループに参加しています");
  });

  it("assertEmailCanBeInvitedToGroupHandler は pending だけでは拒否しない（作成時に古い招待を無効化する）", async () => {
    const baseInvitation = {
      groupId: "group-001" as Id<"groups">,
      invitedByUserId: "https://issuer.example|owner",
      createdAt: 1000,
      updatedAt: 1000,
    };
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-pending" as Id<"groupInvitations">,
          ...baseInvitation,
          email: "pending@example.com",
          token: "pending-token",
          status: "pending",
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "pending@example.com",
      }),
    ).resolves.toBeNull();
  });

  it("assertEmailCanBeInvitedToGroupHandler は所属中メンバーの accepted 招待を拒否する", async () => {
    const memberUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      groupMembers: [
        {
          _id: "member-accepted" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "accepted@example.com",
          token: "accepted-token",
          status: "accepted",
          invitedByUserId: "https://issuer.example|owner",
          acceptedByUserId: memberUserId,
          acceptedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "accepted@example.com",
      }),
    ).rejects.toThrow("このメールアドレスの招待はすでに承認済みです");
  });

  it("assertEmailCanBeInvitedToGroupHandler はグループから外したユーザーの accepted 招待があっても再招待を許可する", async () => {
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "removed@example.com",
          token: "accepted-token",
          status: "accepted",
          invitedByUserId: "https://issuer.example|owner",
          acceptedByUserId: "https://issuer.example|removed",
          acceptedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "removed@example.com",
      }),
    ).resolves.toBeNull();
  });

  it("assertEmailCanBeInvitedToGroupHandler は revoked / expired と別グループの重複を許可する", async () => {
    const ctx = createMockDb({
      users: [
        {
          _id: "user-other" as Id<"users">,
          userId: "https://issuer.example|other",
          displayName: "別グループメンバー",
          email: "member@example.com",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-other" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: "https://issuer.example|other",
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-revoked" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "revoked@example.com",
          token: "revoked-token",
          status: "revoked",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-expired" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "expired@example.com",
          token: "expired-token",
          status: "expired",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-other-group" as Id<"groupInvitations">,
          groupId: "group-002" as Id<"groups">,
          email: "pending@example.com",
          token: "other-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "member@example.com",
      }),
    ).resolves.toBeNull();
    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "revoked@example.com",
      }),
    ).resolves.toBeNull();
    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "expired@example.com",
      }),
    ).resolves.toBeNull();
    await expect(
      assertEmailCanBeInvitedToGroupHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "pending@example.com",
      }),
    ).resolves.toBeNull();
  });

  it("createGroupInvitationRecordHandler は既存 pending を無効化してから新しい招待を作成する", async () => {
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-pending" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "pending-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      createGroupInvitationRecordHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "pending@example.com",
        token: "new-token",
        invitedByUserId: "https://issuer.example|owner",
        clerkInvitationId: "clerk-new",
      }),
    ).resolves.toEqual(expect.any(String));
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-pending",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.insert).toHaveBeenCalled();
  });

  it("createGroupInvitationRecordHandler は複数の pending をまとめて無効化して再招待できる", async () => {
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-pending-1" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "dup@example.com",
          token: "pending-token-1",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-pending-2" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "dup@example.com",
          token: "pending-token-2",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 2000,
          updatedAt: 2000,
        },
      ],
    });

    await expect(
      createGroupInvitationRecordHandler(ctx, {
        groupId: "group-001" as Id<"groups">,
        email: "dup@example.com",
        token: "new-token",
        invitedByUserId: "https://issuer.example|owner",
      }),
    ).resolves.toEqual(expect.any(String));
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-pending-1",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-pending-2",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.insert).toHaveBeenCalled();
  });

  it("deletePendingGroupInvitationRecordByTokenHandler は Clerk ID 未設定の pending 予約だけを削除する", async () => {
    const ctx = createMockDb({
      groupInvitations: [
        {
          _id: "invite-reserved" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "reserved@example.com",
          token: "reserved-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-sent" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "sent@example.com",
          token: "sent-token",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          clerkInvitationId: "clerk-sent",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await expect(
      deletePendingGroupInvitationRecordByTokenHandler(ctx, { token: "reserved-token" }),
    ).resolves.toBe("invite-reserved");
    await expect(
      deletePendingGroupInvitationRecordByTokenHandler(ctx, { token: "sent-token" }),
    ).resolves.toBeNull();
    expect(ctx.db.delete).toHaveBeenCalledTimes(1);
    expect(ctx.db.delete).toHaveBeenCalledWith("invite-reserved");
  });

  it("removeMemberHandler は他メンバー削除後に残りの所属へ activeGroupId を戻す", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target-other" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId })).resolves.toBeUndefined();
    expect(ctx.db.delete).toHaveBeenCalledWith("member-target");
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        groupId: "group-001",
        actorUserId: ownerId,
        action: "member_removed",
        targetKind: "member",
        targetId: targetUserId,
        targetLabel: "メンバー",
      }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-member",
      expect.objectContaining({ activeGroupId: "group-002" }),
    );
  });

  it("addMemberByEmailHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(memberId, "member@example.com"));

    await expect(addMemberByEmailHandler(ctx, { email: "new@example.com" })).rejects.toThrow(
      "グループオーナーのみ実行できます",
    );
  });

  it("removeMemberHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(memberId, "member@example.com"));

    await expect(
      removeMemberHandler(ctx, { targetUserId: "https://issuer.example|other" }),
    ).rejects.toThrow("グループオーナーのみ実行できます");
  });

  it("updateGroupNameHandler は owner が active group の名前を更新する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(updateGroupNameHandler(ctx, { name: " 鈴木家 " })).resolves.toEqual("group-001");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "group-001",
      expect.objectContaining({ name: "鈴木家" }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        groupId: "group-001",
        actorUserId: ownerId,
        action: "group_name_changed",
        beforeValue: "佐藤家",
        afterValue: "鈴木家",
      }),
    );
  });

  it("updateGroupNameHandler は同名の再保存で patch も監査ログも残さない", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(updateGroupNameHandler(ctx, { name: "佐藤家" })).resolves.toEqual("group-001");
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("updateGroupNameHandler は空文字を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(updateGroupNameHandler(ctx, { name: "   " })).rejects.toThrow(
      "グループ名を入力してください",
    );
  });

  it("updateGroupNameHandler は長すぎる名前を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(updateGroupNameHandler(ctx, { name: "あ".repeat(51) })).rejects.toThrow(
      "グループ名は50文字以内で入力してください",
    );
  });

  it("updateGroupNameHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(memberId, "member@example.com"));

    await expect(updateGroupNameHandler(ctx, { name: "新しい名前" })).rejects.toThrow(
      "グループオーナーのみ実行できます",
    );
  });

  it("removeMemberHandler は owner ロールの対象メンバーを拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherOwnerId = "https://issuer.example|other-owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: otherOwnerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId: otherOwnerId })).rejects.toThrow(
      "オーナーはグループから外せません",
    );
  });

  it("removeMemberHandler は自分自身の解除を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId: ownerId })).rejects.toThrow(
      "自分自身に対してこの操作はできません",
    );
    expect(ctx.db.delete).not.toHaveBeenCalled();
  });

  it("removeMemberHandler は active group に所属しないユーザーを拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherGroupMemberId = "https://issuer.example|other-group-member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-group" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: otherGroupMemberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId: otherGroupMemberId })).rejects.toThrow(
      "指定されたメンバーが見つかりません",
    );
    expect(ctx.db.delete).not.toHaveBeenCalled();
  });

  it("removeMemberHandler は users レコードを削除しない", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId })).resolves.toBeUndefined();
    expect(ctx.db.delete).toHaveBeenCalledTimes(1);
    expect(ctx.db.delete).toHaveBeenCalledWith("member-target");
    expect(ctx.db.delete).not.toHaveBeenCalledWith("user-member");
  });

  it("removeMemberHandler は対象メンバーの pending / accepted 招待を revoked にする", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "member@example.com",
          token: "accepted-token",
          status: "accepted",
          invitedByUserId: ownerId,
          acceptedByUserId: targetUserId,
          acceptedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(removeMemberHandler(ctx, { targetUserId })).resolves.toBeUndefined();
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        groupId: "group-001",
        actorUserId: ownerId,
        action: "member_removed",
        targetKind: "member",
        targetId: targetUserId,
      }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-accepted",
      expect.objectContaining({ status: "revoked" }),
    );
  });

  it("changeMemberRoleHandler は member を owner に昇格し監査ログを残す", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      changeMemberRoleHandler(ctx, { targetUserId, newRole: "owner" }),
    ).resolves.toBeUndefined();
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "member-target",
      expect.objectContaining({ role: "owner" }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        action: "member_role_changed",
        beforeValue: "メンバー",
        afterValue: "オーナー",
        targetId: targetUserId,
      }),
    );
  });

  it("changeMemberRoleHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(memberId));

    await expect(
      changeMemberRoleHandler(ctx, {
        targetUserId: "https://issuer.example|other",
        newRole: "owner",
      }),
    ).rejects.toThrow("グループオーナーのみ実行できます");
  });

  it("changeMemberRoleHandler は自分自身のロール変更を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      changeMemberRoleHandler(ctx, { targetUserId: ownerId, newRole: "member" }),
    ).rejects.toThrow("自分自身に対してこの操作はできません");
  });

  it("changeMemberRoleHandler は共同オーナーを member に降格できる", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherOwnerId = "https://issuer.example|other-owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "操作者",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-other-owner" as Id<"users">,
          userId: otherOwnerId,
          displayName: "共同オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-operator" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: otherOwnerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      changeMemberRoleHandler(ctx, { targetUserId: otherOwnerId, newRole: "member" }),
    ).resolves.toBeUndefined();
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "member-other-owner",
      expect.objectContaining({ role: "member" }),
    );
  });

  it("changeMemberRoleHandler は最後の owner の降格を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherOwnerId = "https://issuer.example|other-owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "操作者",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-other-owner" as Id<"users">,
          userId: otherOwnerId,
          displayName: "共同オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-operator" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: otherOwnerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    const guardSpy = vi
      .spyOn(groupAdminGuards, "assertGroupHasMinimumOwners")
      .mockRejectedValue(new ConvexError(GROUP_ADMIN_ERRORS.LAST_OWNER_PROTECTED));

    await expect(
      changeMemberRoleHandler(ctx, { targetUserId: otherOwnerId, newRole: "member" }),
    ).rejects.toThrow(GROUP_ADMIN_ERRORS.LAST_OWNER_PROTECTED);
    expect(guardSpy).toHaveBeenCalledWith(ctx, "group-001", 2);
    expect(ctx.db.patch).not.toHaveBeenCalled();

    guardSpy.mockRestore();
  });

  it("changeMemberRoleHandler は同じロールへの変更を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(changeMemberRoleHandler(ctx, { targetUserId, newRole: "member" })).rejects.toThrow(
      "すでに同じロールです",
    );
  });

  it("transferGroupOwnershipHandler は owner 権限を member に譲渡し監査ログを残す", async () => {
    const ownerId = "https://issuer.example|owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "現オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "譲渡先",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(transferGroupOwnershipHandler(ctx, { targetUserId })).resolves.toBeUndefined();
    expect(ctx.db.patch).toHaveBeenNthCalledWith(
      1,
      "member-target",
      expect.objectContaining({ role: "owner" }),
    );
    expect(ctx.db.patch).toHaveBeenNthCalledWith(
      2,
      "member-owner",
      expect.objectContaining({ role: "member" }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        action: "owner_transferred",
        targetId: targetUserId,
        targetLabel: "譲渡先",
        beforeValue: "オーナー: 現オーナー",
        afterValue: "オーナー: 譲渡先（現オーナー → メンバー）",
      }),
    );
  });

  it("transferGroupOwnershipHandler は共同 owner がいる場合も譲渡できる", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherOwnerId = "https://issuer.example|other-owner";
    const targetUserId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー1",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-other-owner" as Id<"users">,
          userId: otherOwnerId,
          displayName: "オーナー2",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-member" as Id<"users">,
          userId: targetUserId,
          displayName: "譲渡先",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: otherOwnerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: targetUserId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(transferGroupOwnershipHandler(ctx, { targetUserId })).resolves.toBeUndefined();
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "member-target",
      expect.objectContaining({ role: "owner" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "member-owner",
      expect.objectContaining({ role: "member" }),
    );
    expect(ctx.db.patch).not.toHaveBeenCalledWith("member-other-owner", expect.anything());
  });

  it("transferGroupOwnershipHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const targetUserId = "https://issuer.example|other";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(memberId));

    await expect(transferGroupOwnershipHandler(ctx, { targetUserId })).rejects.toThrow(
      GROUP_ADMIN_ERRORS.OWNER_ONLY,
    );
  });

  it("transferGroupOwnershipHandler は自分自身への譲渡を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(transferGroupOwnershipHandler(ctx, { targetUserId: ownerId })).rejects.toThrow(
      GROUP_ADMIN_ERRORS.SELF_OPERATION_FORBIDDEN,
    );
  });

  it("transferGroupOwnershipHandler は他グループのメンバーへの譲渡を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherGroupMemberId = "https://issuer.example|other-group";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-group" as Id<"groupMembers">,
          groupId: "group-002" as Id<"groups">,
          userId: otherGroupMemberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      transferGroupOwnershipHandler(ctx, { targetUserId: otherGroupMemberId }),
    ).rejects.toThrow("指定されたメンバーが見つかりません");
  });

  it("transferGroupOwnershipHandler は pending 招待中ユーザー（groupMembers 不在）への譲渡を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const pendingInviteUserId = "https://issuer.example|pending-only";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-pending" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-pending",
          status: "pending",
          invitedByUserId: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      transferGroupOwnershipHandler(ctx, { targetUserId: pendingInviteUserId }),
    ).rejects.toThrow("指定されたメンバーが見つかりません");
  });

  it("transferGroupOwnershipHandler は owner ロールの譲渡先を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const otherOwnerId = "https://issuer.example|other-owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー1",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "user-other-owner" as Id<"users">,
          userId: otherOwnerId,
          displayName: "オーナー2",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-other-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: otherOwnerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      transferGroupOwnershipHandler(ctx, { targetUserId: otherOwnerId }),
    ).rejects.toThrow(GROUP_ADMIN_ERRORS.TRANSFER_TARGET_MUST_BE_MEMBER);
  });

  it("cancelPendingGroupInvitationHandler は owner が pending 招待をメール単位で revoked にする", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-old" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-old",
          status: "pending",
          invitedByUserId: ownerId,
          clerkInvitationId: "clerk-old",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "invite-new" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-new",
          status: "pending",
          invitedByUserId: ownerId,
          clerkInvitationId: "clerk-new",
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-accepted",
          status: "accepted",
          invitedByUserId: ownerId,
          createdAt: 3000,
          updatedAt: 3000,
        },
      ],
    });
    vi.mocked(ctx.auth.getUserIdentity).mockResolvedValue(createIdentity(ownerId));

    await expect(
      cancelPendingGroupInvitationHandler(ctx, {
        invitationId: "invite-new" as Id<"groupInvitations">,
      }),
    ).resolves.toEqual({ clerkInvitationIds: ["clerk-old", "clerk-new"] });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        groupId: "group-001",
        actorUserId: ownerId,
        action: "invitation_revoked",
        targetKind: "invitation",
        targetId: "invite-new",
        targetLabel: "pending@example.com",
      }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-old",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "invite-new",
      expect.objectContaining({ status: "revoked" }),
    );
    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      "invite-accepted",
      expect.objectContaining({ status: "revoked" }),
    );
  });

  it("cancelPendingGroupInvitationHandler は member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-member" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-001" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-001",
          status: "pending",
          invitedByUserId: "https://issuer.example|owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    vi.mocked(ctx.auth.getUserIdentity).mockResolvedValue(
      createIdentity(memberId, "member@example.com"),
    );

    await expect(
      cancelPendingGroupInvitationHandler(ctx, {
        invitationId: "invite-001" as Id<"groupInvitations">,
      }),
    ).rejects.toThrow("グループオーナーのみ実行できます");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("cancelPendingGroupInvitationHandler は他グループの招待を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-other" as Id<"groupInvitations">,
          groupId: "group-002" as Id<"groups">,
          email: "pending@example.com",
          token: "token-other",
          status: "pending",
          invitedByUserId: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    vi.mocked(ctx.auth.getUserIdentity).mockResolvedValue(createIdentity(ownerId));

    await expect(
      cancelPendingGroupInvitationHandler(ctx, {
        invitationId: "invite-other" as Id<"groupInvitations">,
      }),
    ).rejects.toThrow("現在選択中のグループでのみ実行できます");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("cancelPendingGroupInvitationHandler は accepted 済み招待を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-accepted" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "accepted@example.com",
          token: "token-accepted",
          status: "accepted",
          invitedByUserId: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    vi.mocked(ctx.auth.getUserIdentity).mockResolvedValue(createIdentity(ownerId));

    await expect(
      cancelPendingGroupInvitationHandler(ctx, {
        invitationId: "invite-accepted" as Id<"groupInvitations">,
      }),
    ).rejects.toThrow("この招待は取り消せません");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("cancelPendingGroupInvitationHandler は存在しない招待 ID を拒否する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          email: "owner@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [],
    });
    vi.mocked(ctx.auth.getUserIdentity).mockResolvedValue(createIdentity(ownerId));

    await expect(
      cancelPendingGroupInvitationHandler(ctx, {
        invitationId: "invite-missing" as Id<"groupInvitations">,
      }),
    ).rejects.toThrow("招待が見つかりません");
  });
});

describe("Phase1 owner-only permissions", () => {
  const OWNER_ONLY_ERROR = "グループオーナーのみ実行できます";

  function createMemberContext() {
    const memberId = "https://issuer.example|member";
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          email: "member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-only" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-001" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-001",
          status: "pending",
          invitedByUserId: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi
      .fn()
      .mockResolvedValue(createIdentity(memberId, "member@example.com"));
    return { ctx, memberId, ownerId };
  }

  it.each([
    ["updateGroupName", (ctx: MutationCtx) => updateGroupNameHandler(ctx, { name: "新しい名前" })],
    [
      "removeMember",
      (ctx: MutationCtx) =>
        removeMemberHandler(ctx, { targetUserId: "https://issuer.example|other-member" }),
    ],
    [
      "addMemberByEmail",
      (ctx: MutationCtx) => addMemberByEmailHandler(ctx, { email: "new@example.com" }),
    ],
    ["listPendingGroupInvitations", (ctx: QueryCtx) => listPendingGroupInvitationsHandler(ctx)],
    [
      "cancelPendingGroupInvitation",
      (ctx: MutationCtx) =>
        cancelPendingGroupInvitationHandler(ctx, {
          invitationId: "invite-001" as Id<"groupInvitations">,
        }),
    ],
  ] as const)("member は %s を拒否される", async (_operation, runHandler) => {
    const { ctx } = createMemberContext();
    await expect(runHandler(ctx)).rejects.toThrow(OWNER_ONLY_ERROR);
  });
});

describe("seedGroupMemberForE2eHandler", () => {
  it("同じメールの e2e-seed ユーザーを置き換えて seed する", async () => {
    const existingMemberId = "e2e-seed|group-member-old";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-existing" as Id<"users">,
          userId: existingMemberId,
          displayName: "旧メンバー",
          email: "e2e-removable-member@example.com",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-existing" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: existingMemberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    const result = await seedGroupMemberForE2eHandler(ctx, {
      groupId: "group-001" as Id<"groups">,
      displayName: "E2E解除対象メンバー",
      email: "e2e-removable-member@example.com",
    });

    expect(result.memberUserId).toMatch(/^e2e-seed\|group-member-/);
    expect(result.memberUserId).not.toBe(existingMemberId);
    expect(ctx.db.delete).toHaveBeenCalledWith("member-existing");
    expect(ctx.db.delete).toHaveBeenCalledWith("user-existing");
    expect(ctx.db.insert).toHaveBeenCalledTimes(2);
  });
});

describe("deleteGroupHandler", () => {
  beforeEach(() => {
    vi.spyOn(deleteGroupPhysically, "deleteAllGroupScopedData").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("owner は確認グループ名一致時に物理削除し、監査ログと activeGroupId を補正する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          status: "active",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupInvitations: [
        {
          _id: "invite-001" as Id<"groupInvitations">,
          groupId: "group-001" as Id<"groups">,
          email: "pending@example.com",
          token: "token-001",
          status: "pending",
          invitedByUserId: ownerId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(
      deleteGroupHandler(ctx, { confirmationGroupName: "佐藤家" }),
    ).resolves.toBeUndefined();

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-owner",
      expect.objectContaining({ activeGroupId: undefined }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "managementAuditLogs",
      expect.objectContaining({
        groupId: "group-001",
        actorUserId: ownerId,
        action: "group_deleted",
        targetKind: "group",
        targetLabel: "佐藤家",
      }),
    );
    const auditLogCall = vi
      .mocked(ctx.db.insert)
      .mock.calls.find(([tableName]) => tableName === "managementAuditLogs");
    expect(auditLogCall).toBeDefined();
    const auditLog = auditLogCall?.[1] as { afterValue?: string };
    expect(JSON.parse(auditLog.afterValue ?? "{}")).toEqual(
      expect.objectContaining({
        deletionMode: "immediate",
        affectedCounts: expect.objectContaining({
          members: 1,
          invitations: expect.any(Number),
          sourceDocuments: expect.any(Number),
          expenseEntries: expect.any(Number),
          receipts: expect.any(Number),
          categories: expect.any(Number),
          aiDrafts: expect.any(Number),
          aiDraftItems: expect.any(Number),
          analysisBatches: expect.any(Number),
          analysisJobs: expect.any(Number),
          weekSessions: expect.any(Number),
        }),
      }),
    );
    expect(deleteGroupPhysically.deleteAllGroupScopedData).toHaveBeenCalledWith(ctx, "group-001");
  });

  it("確認グループ名が一致しない場合は削除しない", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-owner" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(deleteGroupHandler(ctx, { confirmationGroupName: "鈴木家" })).rejects.toThrow(
      GROUP_ADMIN_ERRORS.GROUP_NAME_MISMATCH,
    );
    expect(deleteGroupPhysically.deleteAllGroupScopedData).not.toHaveBeenCalled();
  });

  it("member ロールの呼び出しを拒否する", async () => {
    const memberId = "https://issuer.example|member";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-001" as Id<"groups">,
          name: "佐藤家",
          status: "active",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-member" as Id<"users">,
          userId: memberId,
          displayName: "メンバー",
          activeGroupId: "group-001" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-target" as Id<"groupMembers">,
          groupId: "group-001" as Id<"groups">,
          userId: memberId,
          role: "member",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(memberId));

    await expect(deleteGroupHandler(ctx, { confirmationGroupName: "佐藤家" })).rejects.toThrow(
      GROUP_ADMIN_ERRORS.OWNER_ONLY,
    );
  });

  it("listMyGroupsHandler は deleted / archived グループを一覧から除外する", async () => {
    const ownerId = "https://issuer.example|owner";
    const ctx = createMockDb({
      groups: [
        {
          _id: "group-deleted" as Id<"groups">,
          name: "旧グループ",
          status: "deleted",
          deletedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          _id: "group-archived" as Id<"groups">,
          name: "アーカイブ済み",
          status: "archived",
          archivedAt: 2000,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          _id: "group-active" as Id<"groups">,
          name: "現グループ",
          status: "active",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      users: [
        {
          _id: "user-owner" as Id<"users">,
          userId: ownerId,
          displayName: "オーナー",
          activeGroupId: "group-active" as Id<"groups">,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      groupMembers: [
        {
          _id: "member-deleted" as Id<"groupMembers">,
          groupId: "group-deleted" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-archived" as Id<"groupMembers">,
          groupId: "group-archived" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "member-active" as Id<"groupMembers">,
          groupId: "group-active" as Id<"groups">,
          userId: ownerId,
          role: "owner",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(createIdentity(ownerId));

    await expect(listMyGroupsHandler(ctx)).resolves.toEqual([
      expect.objectContaining({ _id: "group-active", name: "現グループ", isActive: true }),
    ]);
  });
});

import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  acceptGroupInvitationHandler,
  addMemberByEmailHandler,
  createGroupHandler,
  getGroupMembership,
  invitationEmailsMatch,
  listMyGroupsHandler,
  removeMemberHandler,
  setActiveGroupHandler,
} from "./groups";

type GroupDoc = {
  _id: Id<"groups">;
  name: string;
  clerkOrganizationId?: string;
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

  const insert = vi.fn(async (tableName: string, doc: Record<string, unknown>) => {
    const id = `${tableName}-${insert.mock.calls.length}` as Id<
      "groups" | "users" | "groupMembers" | "groupInvitations"
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
          return indexName === "by_token";
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
                : groupInvitations;

        return source.filter((doc) => {
          if (indexName === "by_token_identifier" && "userId" in doc) {
            return doc.userId === filters.userId;
          }
          if (indexName === "by_email" && "email" in doc) {
            return doc.email === filters.email;
          }
          if (indexName === "by_user_id" && "userId" in doc) {
            return doc.userId === filters.userId;
          }
          if (indexName === "by_group_id" && "groupId" in doc) {
            return doc.groupId === filters.groupId;
          }
          if (indexName === "by_group_id_and_user_id" && "groupId" in doc && "userId" in doc) {
            return doc.groupId === filters.groupId && doc.userId === filters.userId;
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
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "user-member",
      expect.objectContaining({ activeGroupId: "group-002" }),
    );
  });
});

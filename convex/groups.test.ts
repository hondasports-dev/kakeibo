import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { addMemberByEmailHandler } from "./groups";

const GROUP_ID = "group-001" as Id<"groups">;
const OWNER_USER_ID = "https://issuer.example|owner";
const MEMBER_USER_ID = "https://issuer.example|member";

type GroupMemberDoc = {
  _id: string;
  _creationTime: number;
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
  createdAt: number;
  updatedAt: number;
};

type UserDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  displayName: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
};

function createIdentity(userId: string): UserIdentity {
  return {
    tokenIdentifier: userId,
    subject: userId,
    issuer: "https://issuer.example",
  };
}

function createCtx(options: {
  currentRole: "owner" | "member";
  targetUser?: UserDoc | null;
  existingTargetMembership?: GroupMemberDoc | null;
}) {
  const currentMembership: GroupMemberDoc = {
    _id: "membership-current",
    _creationTime: 1000,
    groupId: GROUP_ID,
    userId: OWNER_USER_ID,
    role: options.currentRole,
    createdAt: 1000,
    updatedAt: 1000,
  };
  const insertMock = vi.fn().mockResolvedValue("membership-new");

  const ctx = {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(createIdentity(OWNER_USER_ID)),
    },
    db: {
      insert: insertMock,
      query: vi.fn().mockImplementation((tableName: string) => ({
        withIndex: vi
          .fn()
          .mockImplementation((_indexName: string, builder: (q: unknown) => void) => {
            let capturedValue: unknown = null;
            const q = {
              eq: vi.fn().mockImplementation((_field: string, value: unknown) => {
                capturedValue = value;
                return q;
              }),
            };
            builder(q);

            return {
              unique: vi.fn().mockImplementation(async () => {
                if (tableName === "groupMembers" && capturedValue === OWNER_USER_ID) {
                  return currentMembership;
                }
                if (tableName === "groupMembers" && capturedValue === MEMBER_USER_ID) {
                  return options.existingTargetMembership ?? null;
                }
                if (tableName === "users" && capturedValue === "member@example.com") {
                  return options.targetUser ?? null;
                }
                return null;
              }),
            };
          }),
      })),
    },
  } as unknown as MutationCtx;

  return { ctx, insertMock };
}

describe("groups.addMemberByEmailHandler", () => {
  it("オーナーはClerkログイン済みユーザーをメールでグループに追加できる", async () => {
    const targetUser: UserDoc = {
      _id: "user-member",
      _creationTime: 1000,
      userId: MEMBER_USER_ID,
      displayName: "メンバー",
      email: "member@example.com",
      createdAt: 1000,
      updatedAt: 1000,
    };
    const { ctx, insertMock } = createCtx({ currentRole: "owner", targetUser });

    await addMemberByEmailHandler(ctx, { email: " MEMBER@example.com " });

    expect(insertMock).toHaveBeenCalledWith("groupMembers", {
      groupId: GROUP_ID,
      userId: MEMBER_USER_ID,
      role: "member",
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it("メンバーは他ユーザーを追加できない", async () => {
    const { ctx } = createCtx({ currentRole: "member" });

    await expect(addMemberByEmailHandler(ctx, { email: "member@example.com" })).rejects.toThrow(
      ConvexError,
    );
  });

  it("Clerk招待後に未ログインのメールは追加できない", async () => {
    const { ctx } = createCtx({ currentRole: "owner", targetUser: null });

    await expect(addMemberByEmailHandler(ctx, { email: "member@example.com" })).rejects.toThrow(
      ConvexError,
    );
  });
});

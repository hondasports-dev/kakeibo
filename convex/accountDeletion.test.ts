import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  deleteOrphanedGroupMemberships,
  loadAccountDeletionClassification,
} from "./accountDeletion";

describe("loadAccountDeletionClassification", () => {
  it("削除済みグループへの membership を回収対象にし、有効な共有グループは離脱として分類する", async () => {
    const orphanMembership = {
      _id: "membership-orphan" as Id<"groupMembers">,
      groupId: "group-deleted" as Id<"groups">,
      userId: "user-001",
      role: "owner" as const,
    };
    const activeMembership = {
      _id: "membership-active" as Id<"groupMembers">,
      groupId: "group-active" as Id<"groups">,
      userId: "user-001",
      role: "member" as const,
    };
    const withIndex = vi.fn((indexName: string) => {
      if (indexName === "by_user_id") {
        return { collect: vi.fn().mockResolvedValue([orphanMembership, activeMembership]) };
      }
      return {
        collect: vi.fn().mockResolvedValue([
          { ...activeMembership, role: "member" },
          { ...activeMembership, _id: "membership-owner", userId: "owner-001", role: "owner" },
        ]),
      };
    });
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({ withIndex }),
        get: vi
          .fn()
          .mockImplementation(async (groupId: Id<"groups">) =>
            groupId === "group-active" ? { _id: groupId, name: "共有家計" } : null,
          ),
      },
    } as unknown as Pick<QueryCtx, "db">;

    const result = await loadAccountDeletionClassification(ctx, "user-001");

    expect(result.classification.groupsToLeave).toMatchObject([
      { groupId: "group-active", groupName: "共有家計", role: "member" },
    ]);
    expect(result.orphanMemberships).toEqual([orphanMembership]);
  });
});

describe("deleteOrphanedGroupMemberships", () => {
  it("孤立 membership だけを削除する", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const orphanMembership = { _id: "membership-orphan" as Id<"groupMembers"> };

    await deleteOrphanedGroupMemberships(
      { db: { delete: deleteMock } } as unknown as Pick<MutationCtx, "db">,
      [orphanMembership],
    );

    expect(deleteMock).toHaveBeenCalledOnce();
    expect(deleteMock).toHaveBeenCalledWith("membership-orphan");
  });
});

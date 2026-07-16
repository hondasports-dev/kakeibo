import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  GROUP_ADMIN_ERRORS,
  assertActiveGroupScope,
  assertAnotherGroupOwnerRemains,
  assertGroupOwnerRole,
  assertNotSelfOperator,
  assertRemovableGroupMemberRole,
} from "./adminGuards";

function createOwnerThresholdContext(ownerMembershipIds: Array<Id<"groupMembers">>) {
  const eq = vi.fn();
  const queryBuilder = { eq };
  eq.mockReturnValue(queryBuilder);

  const collect = vi.fn(() => {
    throw new Error("collect must not be called");
  });
  const take = vi.fn(async (count: number) =>
    ownerMembershipIds.slice(0, count).map((_id) => ({ _id, role: "owner" as const })),
  );
  const withIndex = vi.fn(
    (_indexName: string, buildIndex: (builder: typeof queryBuilder) => unknown) => {
      buildIndex(queryBuilder);
      return { collect, take };
    },
  );
  const query = vi.fn().mockReturnValue({ withIndex });

  return {
    ctx: { db: { query } } as unknown as Pick<QueryCtx, "db">,
    collect,
    eq,
    query,
    take,
    withIndex,
  };
}

describe("groupAdminGuards", () => {
  it("assertGroupOwnerRole は member を拒否する", () => {
    expect(() => assertGroupOwnerRole("member")).toThrow(ConvexError);
    expect(() => assertGroupOwnerRole("member")).toThrow(GROUP_ADMIN_ERRORS.OWNER_ONLY);
  });

  it("assertActiveGroupScope は active group 不一致を拒否する", () => {
    expect(() =>
      assertActiveGroupScope("group-001" as Id<"groups">, "group-002" as Id<"groups">),
    ).toThrow(GROUP_ADMIN_ERRORS.NOT_ACTIVE_GROUP);
  });

  it("assertNotSelfOperator は自分自身への操作を拒否する", () => {
    expect(() => assertNotSelfOperator("user-a", "user-a")).toThrow(
      GROUP_ADMIN_ERRORS.SELF_OPERATION_FORBIDDEN,
    );
  });

  it("assertRemovableGroupMemberRole は owner 対象を拒否する", () => {
    expect(() => assertRemovableGroupMemberRole("owner")).toThrow(
      GROUP_ADMIN_ERRORS.OWNER_MEMBER_NOT_REMOVABLE,
    );
  });

  it("assertAnotherGroupOwnerRemains は groupId と owner role を index で絞り take(2) する", async () => {
    const targetMembershipId = "member-target" as Id<"groupMembers">;
    const otherOwnerMembershipId = "member-other-owner" as Id<"groupMembers">;
    const { ctx, collect, eq, query, take, withIndex } = createOwnerThresholdContext([
      targetMembershipId,
      otherOwnerMembershipId,
      "member-third-owner" as Id<"groupMembers">,
    ]);

    await expect(
      assertAnotherGroupOwnerRemains(
        ctx,
        "group-001" as Id<"groups">,
        targetMembershipId,
      ),
    ).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledWith("groupMembers");
    expect(withIndex).toHaveBeenCalledWith("by_group_id_and_role", expect.any(Function));
    expect(eq).toHaveBeenNthCalledWith(1, "groupId", "group-001");
    expect(eq).toHaveBeenNthCalledWith(2, "role", "owner");
    expect(take).toHaveBeenCalledWith(2);
    expect(collect).not.toHaveBeenCalled();
  });

  it.each([
    { label: "owner が0人", ownerMembershipIds: [] },
    { label: "降格対象だけがowner", ownerMembershipIds: ["member-target"] },
  ])("assertAnotherGroupOwnerRemains は $label なら拒否する", async ({ ownerMembershipIds }) => {
    const targetMembershipId = "member-target" as Id<"groupMembers">;
    const { ctx } = createOwnerThresholdContext(
      ownerMembershipIds.map((id) => id as Id<"groupMembers">),
    );

    await expect(
      assertAnotherGroupOwnerRemains(
        ctx,
        "group-001" as Id<"groups">,
        targetMembershipId,
      ),
    ).rejects.toThrow(GROUP_ADMIN_ERRORS.LAST_OWNER_PROTECTED);
  });

  it.each([
    ["owner が2人", ["member-target", "member-other-owner"]],
    ["owner が3人以上", ["member-target", "member-other-owner", "member-third-owner"]],
  ])("assertAnotherGroupOwnerRemains は %s なら許可する", async (_label, ids) => {
    const targetMembershipId = "member-target" as Id<"groupMembers">;
    const { ctx } = createOwnerThresholdContext(
      ids.map((id) => id as Id<"groupMembers">),
    );

    await expect(
      assertAnotherGroupOwnerRemains(
        ctx,
        "group-001" as Id<"groups">,
        targetMembershipId,
      ),
    ).resolves.toBeUndefined();
  });
});

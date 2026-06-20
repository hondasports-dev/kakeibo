import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  GROUP_ADMIN_ERRORS,
  assertActiveGroupScope,
  assertGroupHasMinimumOwners,
  assertGroupOwnerRole,
  assertNotSelfOperator,
  assertRemovableGroupMemberRole,
  countGroupOwners,
} from "./groupAdminGuards";

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

  it("countGroupOwners は owner ロールの件数を返す", async () => {
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            collect: vi
              .fn()
              .mockResolvedValue([{ role: "owner" }, { role: "member" }, { role: "owner" }]),
          }),
        }),
      },
    };

    await expect(
      countGroupOwners(ctx as unknown as Pick<QueryCtx, "db">, "group-001" as Id<"groups">),
    ).resolves.toBe(2);
  });

  it("assertGroupHasMinimumOwners は owner 不足を拒否する", async () => {
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            collect: vi.fn().mockResolvedValue([{ role: "owner" }]),
          }),
        }),
      },
    };

    await expect(
      assertGroupHasMinimumOwners(
        ctx as unknown as Pick<QueryCtx, "db">,
        "group-001" as Id<"groups">,
        2,
      ),
    ).rejects.toThrow(GROUP_ADMIN_ERRORS.LAST_OWNER_PROTECTED);
  });
});

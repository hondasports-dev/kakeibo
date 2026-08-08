import { describe, expect, it } from "vitest";
import {
  getGroupAdminErrorMessage,
  validateActiveGroupScope,
  validateGroupOwnerRole,
  validateNotSelfOperator,
  validateRemovableGroupMemberRole,
} from "./admin";

describe("validateGroupOwnerRole", () => {
  it("owner なら成功", () => {
    expect(validateGroupOwnerRole("owner")).toEqual({ success: true });
  });

  it("member なら失敗", () => {
    expect(validateGroupOwnerRole("member")).toEqual({
      success: false,
      error: "owner_only",
    });
  });
});

describe("validateActiveGroupScope", () => {
  it("同一グループなら成功", () => {
    expect(validateActiveGroupScope("g1", "g1")).toEqual({ success: true });
  });

  it("異なるグループなら失敗", () => {
    expect(validateActiveGroupScope("g1", "g2")).toEqual({
      success: false,
      error: "not_active_group",
    });
  });
});

describe("validateNotSelfOperator", () => {
  it("異なるユーザーなら成功", () => {
    expect(validateNotSelfOperator("u1", "u2")).toEqual({ success: true });
  });

  it("同一ユーザーなら失敗", () => {
    expect(validateNotSelfOperator("u1", "u1")).toEqual({
      success: false,
      error: "self_operation_forbidden",
    });
  });
});

describe("validateRemovableGroupMemberRole", () => {
  it("member なら成功", () => {
    expect(validateRemovableGroupMemberRole("member")).toEqual({ success: true });
  });

  it("owner なら失敗", () => {
    expect(validateRemovableGroupMemberRole("owner")).toEqual({
      success: false,
      error: "owner_member_not_removable",
    });
  });
});

describe("getGroupAdminErrorMessage", () => {
  it.each([
    ["owner_only", "グループオーナーのみ実行できます"],
    ["not_active_group", "現在選択中のグループでのみ実行できます"],
    ["self_operation_forbidden", "自分自身に対してこの操作はできません"],
    ["owner_member_not_removable", "オーナーはグループから外せません"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getGroupAdminErrorMessage(error)).toBe(expected);
  });
});

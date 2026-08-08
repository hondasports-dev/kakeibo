import { describe, expect, it } from "vitest";
import {
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

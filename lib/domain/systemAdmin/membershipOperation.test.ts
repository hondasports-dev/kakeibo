import { describe, expect, it } from "vitest";
import {
  getMembershipOperationShapeErrorMessage,
  validateMembershipOperationShape,
} from "./membershipOperation";

describe("validateMembershipOperationShape", () => {
  it.each([
    ["add", undefined, "g2"],
    ["remove", "g1", undefined],
    ["transfer", "g1", "g2"],
    ["set_active", undefined, "g2"],
    ["clear_active", undefined, undefined],
  ] as const)("%s は有効な操作形状", (operation, source, target) => {
    expect(validateMembershipOperationShape(operation, source, target)).toEqual({
      success: true,
    });
  });

  it("無効な操作形状を検出する", () => {
    expect(validateMembershipOperationShape("add", "g1", undefined)).toEqual({
      success: false,
      error: "invalid_shape",
    });
  });

  it("transfer で source と target が同じ場合を検出する", () => {
    expect(validateMembershipOperationShape("transfer", "g1", "g1")).toEqual({
      success: false,
      error: "same_source_target",
    });
  });
});

describe("getMembershipOperationShapeErrorMessage", () => {
  it.each([
    ["invalid_shape", "操作対象グループの指定が不正です"],
    ["same_source_target", "移動元と移動先は異なるグループを指定してください"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getMembershipOperationShapeErrorMessage(error)).toBe(expected);
  });
});

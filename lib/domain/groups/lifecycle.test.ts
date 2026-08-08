import { describe, expect, it } from "vitest";
import { assertGroupNotDeleted, isGroupDeleted } from "./lifecycle";

describe("isGroupDeleted", () => {
  it.each([
    ["active", false],
    ["deleting", true],
    ["deleted", true],
    ["archived", true],
    [undefined, false],
  ] as const)("status=%s の場合 isGroupDeleted=%s", (status, expected) => {
    expect(isGroupDeleted({ status })).toBe(expected);
  });
});

describe("assertGroupNotDeleted", () => {
  it("active なら成功", () => {
    expect(assertGroupNotDeleted({ status: "active" })).toEqual({ success: true });
  });

  it("deleted なら失敗", () => {
    expect(assertGroupNotDeleted({ status: "deleted" })).toEqual({
      success: false,
      error: "group_deleted",
    });
  });
});

import { describe, expect, it } from "vitest";
import { formatGroupRoleLabel, type GroupRole } from "./role";

describe("formatGroupRoleLabel", () => {
  it.each<[GroupRole, string]>([
    ["owner", "オーナー"],
    ["member", "メンバー"],
  ])("%s -> %s", (role, expected) => {
    expect(formatGroupRoleLabel(role)).toBe(expected);
  });
});

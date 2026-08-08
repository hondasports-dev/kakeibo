import { describe, expect, it } from "vitest";
import { resolveActiveMembership } from "./membershipResolution";

describe("resolveActiveMembership", () => {
  it("空配列の場合は null を返す", () => {
    expect(resolveActiveMembership([], "group-1")).toBeNull();
  });

  it("activeGroupId が未設定でメンバーシップが1件ならそれを返す", () => {
    const memberships = [{ groupId: "group-1" }];
    expect(resolveActiveMembership(memberships, null)).toEqual(memberships[0]);
  });

  it("activeGroupId が未設定でメンバーシップが複数なら null を返す", () => {
    const memberships = [{ groupId: "group-1" }, { groupId: "group-2" }];
    expect(resolveActiveMembership(memberships, undefined)).toBeNull();
  });

  it("activeGroupId に一致するメンバーシップを返す", () => {
    const memberships = [{ groupId: "group-1" }, { groupId: "group-2" }];
    expect(resolveActiveMembership(memberships, "group-2")).toEqual(memberships[1]);
  });

  it("activeGroupId に一致しない場合は null を返す", () => {
    const memberships = [{ groupId: "group-1" }];
    expect(resolveActiveMembership(memberships, "group-2")).toBeNull();
  });
});

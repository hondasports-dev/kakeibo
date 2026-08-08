import { describe, expect, it } from "vitest";
import { sortGroupMembersForDisplay } from "./members";

describe("sortGroupMembersForDisplay", () => {
  it("owner が先、次に displayName 順、同じなら createdAt 昇順", () => {
    const members = [
      { userId: "u1", role: "member" as const, displayName: "いとう", email: null, createdAt: 200 },
      { userId: "u2", role: "owner" as const, displayName: "あべ", email: null, createdAt: 100 },
      { userId: "u3", role: "member" as const, displayName: "いとう", email: null, createdAt: 100 },
      {
        userId: "u4",
        role: "member" as const,
        displayName: "",
        email: "z@example.com",
        createdAt: 50,
      },
    ];
    const sorted = sortGroupMembersForDisplay(members);
    expect(sorted[0].userId).toBe("u2");
    expect(sorted.map((m) => m.userId).slice(1)).toEqual(["u4", "u3", "u1"]);
  });

  it("displayName が空なら email を使う", () => {
    const members = [
      {
        userId: "u1",
        role: "member" as const,
        displayName: "",
        email: "z@example.com",
        createdAt: 100,
      },
      {
        userId: "u2",
        role: "member" as const,
        displayName: "",
        email: "a@example.com",
        createdAt: 100,
      },
    ];
    const sorted = sortGroupMembersForDisplay(members);
    expect(sorted.map((m) => m.userId)).toEqual(["u2", "u1"]);
  });
});

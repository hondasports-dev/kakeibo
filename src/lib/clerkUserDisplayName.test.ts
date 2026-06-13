import { describe, expect, it } from "vitest";
import { getClerkUserFriendlyDisplayName } from "./clerkUserDisplayName";

describe("getClerkUserFriendlyDisplayName", () => {
  it("fullName を最優先で返す", () => {
    expect(
      getClerkUserFriendlyDisplayName({
        fullName: "ログイン 太郎",
        username: "login-taro",
        firstName: "ログイン",
        lastName: "太郎",
        primaryEmailAddress: { emailAddress: "login@example.com" },
      }),
    ).toBe("ログイン 太郎");
  });

  it("fullName がなければ username、氏名、メールの順でフォールバックする", () => {
    expect(
      getClerkUserFriendlyDisplayName({
        fullName: null,
        username: "login-taro",
        firstName: "ログイン",
        lastName: "太郎",
        primaryEmailAddress: { emailAddress: "login@example.com" },
      }),
    ).toBe("login-taro");
    expect(
      getClerkUserFriendlyDisplayName({
        fullName: null,
        username: null,
        firstName: "ログイン",
        lastName: "太郎",
        primaryEmailAddress: { emailAddress: "login@example.com" },
      }),
    ).toBe("ログイン 太郎");
    expect(
      getClerkUserFriendlyDisplayName({
        fullName: null,
        username: null,
        firstName: null,
        lastName: null,
        primaryEmailAddress: { emailAddress: "login@example.com" },
      }),
    ).toBe("login@example.com");
  });
});

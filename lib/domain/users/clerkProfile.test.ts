import { describe, expect, it } from "vitest";
import {
  getClerkUserDisplayName,
  getPrimaryVerifiedClerkEmailAddress,
  getVerifiedClerkEmailAddresses,
} from "./clerkProfile";

describe("getVerifiedClerkEmailAddresses", () => {
  it("verified メールだけを小文字・trim して返す", () => {
    expect(
      getVerifiedClerkEmailAddresses({
        emailAddresses: [
          { id: "1", emailAddress: "  Foo@Example.com  ", verification: { status: "verified" } },
          { id: "2", emailAddress: "unverified@example.com", verification: { status: "pending" } },
        ],
      }),
    ).toEqual(["foo@example.com"]);
  });
});

describe("getPrimaryVerifiedClerkEmailAddress", () => {
  it("primary verified メールを優先して返す", () => {
    expect(
      getPrimaryVerifiedClerkEmailAddress({
        primaryEmailAddressId: "p",
        emailAddresses: [
          { id: "p", emailAddress: "Primary@Example.com", verification: { status: "verified" } },
          { id: "s", emailAddress: "secondary@example.com", verification: { status: "verified" } },
        ],
      }),
    ).toBe("primary@example.com");
  });

  it("primary が未検証なら verified 一覧の先頭を返す", () => {
    expect(
      getPrimaryVerifiedClerkEmailAddress({
        primaryEmailAddressId: "p",
        emailAddresses: [
          { id: "p", emailAddress: "primary@example.com", verification: { status: "pending" } },
          { id: "s", emailAddress: "secondary@example.com", verification: { status: "verified" } },
        ],
      }),
    ).toBe("secondary@example.com");
  });
});

describe("getClerkUserDisplayName", () => {
  it.each([
    [{ username: "  taro  " }, undefined, "taro"],
    [{ firstName: "Taro", lastName: "Yamada" }, undefined, "Taro Yamada"],
    [{}, "fallback@example.com", "fallback@example.com"],
    [{}, undefined, "ユーザー"],
  ] as const)("%o fallback=%s -> %s", (user, fallback, expected) => {
    expect(getClerkUserDisplayName(user as never, fallback)).toBe(expected);
  });
});

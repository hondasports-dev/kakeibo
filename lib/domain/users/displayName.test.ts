import { describe, expect, it } from "vitest";
import { resolveDisplayName } from "./displayName";

describe("resolveDisplayName", () => {
  it("identity.name があれば優先して返す", () => {
    expect(
      resolveDisplayName({
        name: "  Taro  ",
        email: "taro@example.com",
        existingDisplayName: "Old",
      }),
    ).toBe("Taro");
  });

  it("name が空・undefined の場合は既存表示名を使う", () => {
    expect(resolveDisplayName({ existingDisplayName: "Existing" })).toBe("Existing");
  });

  it("既存表示名が既定値の場合は email を使う", () => {
    expect(resolveDisplayName({ email: "taro@example.com", existingDisplayName: "ユーザー" })).toBe(
      "taro@example.com",
    );
  });

  it("fallback を指定できる", () => {
    expect(resolveDisplayName({ fallback: "Guest" })).toBe("Guest");
    expect(
      resolveDisplayName({ email: "a@b.com", existingDisplayName: "Guest", fallback: "Guest" }),
    ).toBe("a@b.com");
  });

  it("すべて欠けている場合は既定値を返す", () => {
    expect(resolveDisplayName({})).toBe("ユーザー");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it.each([" Taro@Example.com ", "TARO@EXAMPLE.COM", "taro@example.com"])(
    "%s を小文字・trim して正規化",
    (email) => {
      expect(normalizeEmail(email)).toBe("taro@example.com");
    },
  );

  it.each([undefined, "", "   "])("%s は undefined を返す", (email) => {
    expect(normalizeEmail(email)).toBeUndefined();
  });
});

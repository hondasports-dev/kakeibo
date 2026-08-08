import { describe, expect, it } from "vitest";
import { MAX_REASON_LENGTH, normalizeSystemAdminReason } from "./reason";

describe("normalizeSystemAdminReason", () => {
  it("trim して正規化する", () => {
    expect(normalizeSystemAdminReason("  test reason  ")).toEqual({
      success: true,
      reason: "test reason",
    });
  });

  it("空文字はエラー", () => {
    expect(normalizeSystemAdminReason("   ")).toEqual({
      success: false,
      error: "empty",
    });
  });

  it(`${MAX_REASON_LENGTH} 文字超過はエラー`, () => {
    expect(normalizeSystemAdminReason("a".repeat(MAX_REASON_LENGTH + 1))).toEqual({
      success: false,
      error: "too_long",
    });
  });
});

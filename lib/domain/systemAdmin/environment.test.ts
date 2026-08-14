import { describe, expect, it } from "vitest";
import { getResolveAppEnvironmentErrorMessage, resolveAppEnvironment } from "./environment";

describe("resolveAppEnvironment", () => {
  it.each([
    ["production", "production"],
    ["preview", "preview"],
    ["development", "development"],
  ] as const)("current=%s を返す", (current, expected) => {
    expect(resolveAppEnvironment(current)).toEqual({
      success: true,
      environment: expected,
    });
  });

  it("未知の env は development にフォールバック", () => {
    expect(resolveAppEnvironment("staging")).toEqual({
      success: true,
      environment: "development",
    });
  });

  it("expected と一致しない場合は mismatch エラー", () => {
    expect(resolveAppEnvironment("development", "production")).toEqual({
      success: false,
      error: "mismatch",
    });
  });
});

describe("getResolveAppEnvironmentErrorMessage", () => {
  it.each([
    ["mismatch", "対象環境が一致しません"],
    ["unknown", "不明な環境です"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getResolveAppEnvironmentErrorMessage(error)).toBe(expected);
  });
});

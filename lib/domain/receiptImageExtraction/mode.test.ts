import { describe, expect, it } from "vitest";
import { getResolveExtractorModeErrorMessage, resolveExtractorMode } from "./mode";

describe("resolveExtractorMode", () => {
  it("mode が未設定の場合、production ではエラー、それ以外は mock を返す", () => {
    expect(resolveExtractorMode({ appEnv: "production" })).toEqual({
      error: "missing_required",
    });
    expect(resolveExtractorMode({ appEnv: "development" })).toEqual({
      mode: "mock",
    });
  });

  it("空文字の mode は未設定と同じ扱い", () => {
    expect(resolveExtractorMode({ appEnv: "production", mode: "" })).toEqual({
      error: "missing_required",
    });
    expect(resolveExtractorMode({ appEnv: "development", mode: "" })).toEqual({
      mode: "mock",
    });
  });

  it("mock / real はそのまま返す", () => {
    expect(resolveExtractorMode({ appEnv: "production", mode: "mock" })).toEqual({
      mode: "mock",
    });
    expect(resolveExtractorMode({ appEnv: "production", mode: "real" })).toEqual({
      mode: "real",
    });
  });

  it("それ以外の mode は invalid エラー", () => {
    expect(resolveExtractorMode({ appEnv: "production", mode: "auto" })).toEqual({
      error: "invalid",
    });
  });
});

describe("getResolveExtractorModeErrorMessage", () => {
  it.each([
    ["missing_required", "RECEIPT_IMAGE_EXTRACTOR_MODE を production では必ず設定してください"],
    ["invalid", "RECEIPT_IMAGE_EXTRACTOR_MODE は mock または real のどちらかを指定してください"],
  ] as const)("%s -> %s", (error, expected) => {
    expect(getResolveExtractorModeErrorMessage(error)).toBe(expected);
  });
});

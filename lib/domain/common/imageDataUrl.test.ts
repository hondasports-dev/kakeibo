import { describe, expect, it } from "vitest";
import { MAX_IMAGE_DATA_URL_LENGTH, validateImageDataUrl } from "./imageDataUrl";

describe("imageDataUrl", () => {
  it("data URL の最大長は Convex 1MB 制限を下回る 900000 文字", () => {
    expect(MAX_IMAGE_DATA_URL_LENGTH).toBe(900_000);
  });

  it("JPEG の Data URL は有効", () => {
    expect(validateImageDataUrl("data:image/jpeg;base64,abcd").success).toBe(true);
  });

  it("Data URL 形式でない場合は invalid_format", () => {
    expect(validateImageDataUrl("https://example.com")).toEqual({
      success: false,
      error: "invalid_format",
    });
  });

  it("base64 マーカーがない場合は missing_base64_marker", () => {
    expect(validateImageDataUrl("data:image/jpeg,abcd")).toEqual({
      success: false,
      error: "missing_base64_marker",
    });
  });

  it("長さ超過の場合は too_large", () => {
    const large = `data:image/jpeg;base64,${"a".repeat(MAX_IMAGE_DATA_URL_LENGTH)}`;
    expect(validateImageDataUrl(large)).toEqual({
      success: false,
      error: "too_large",
    });
  });

  it("base64 ボディが空の場合は empty_base64", () => {
    expect(validateImageDataUrl("data:image/jpeg;base64,")).toEqual({
      success: false,
      error: "empty_base64",
    });
  });

  it("対応外 MIME タイプの場合は unsupported_mime_type", () => {
    expect(validateImageDataUrl("data:image/svg;base64,abcd")).toEqual({
      success: false,
      error: "unsupported_mime_type",
    });
  });

  it("不正な base64 の場合は invalid_base64", () => {
    expect(validateImageDataUrl("data:image/jpeg;base64,abc===")).toEqual({
      success: false,
      error: "invalid_base64",
    });
  });
});

import { describe, expect, it } from "vitest";
import { MAX_IMAGE_DATA_URL_LENGTH } from "./imageDataUrl";

describe("imageDataUrl", () => {
  it("data URL の最大長は Convex 1MB 制限を下回る 900000 文字", () => {
    expect(MAX_IMAGE_DATA_URL_LENGTH).toBe(900_000);
  });
});

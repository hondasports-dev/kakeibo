import { describe, expect, it } from "vitest";
import {
  MAX_LINE_IMAGE_RAW_BYTES,
  bytesToBase64,
  normalizeImageContentType,
  toImageDataUrl,
} from "./content";

describe("LINE image content conversion", () => {
  it("許可されたMIMEだけをdata URLにする", () => {
    expect(normalizeImageContentType("image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(normalizeImageContentType("image/jpg")).toBe("image/jpeg");
    expect(normalizeImageContentType("application/octet-stream")).toBeNull();

    const converted = toImageDataUrl({
      bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
    });
    expect(converted).toEqual({
      ok: true,
      dataUrl: `data:image/jpeg;base64,${bytesToBase64(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))}`,
    });
  });

  it("空・未対応・大きすぎる画像を拒否する", () => {
    expect(toImageDataUrl({ bytes: new Uint8Array(), contentType: "image/jpeg" })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(toImageDataUrl({ bytes: Uint8Array.from([1]), contentType: "video/mp4" })).toEqual({
      ok: false,
      error: "unsupported_mime_type",
    });

    const oversized = new Uint8Array(MAX_LINE_IMAGE_RAW_BYTES + 1);
    oversized.fill(1);
    expect(toImageDataUrl({ bytes: oversized, contentType: "image/jpeg" })).toEqual({
      ok: false,
      error: "too_large",
    });
  });
});

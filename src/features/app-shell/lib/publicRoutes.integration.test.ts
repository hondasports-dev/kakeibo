import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS, isPublicPath } from "./publicPaths";

describe("public legal routes (#251)", () => {
  it("/privacy と /terms を公開パスとして扱う", () => {
    expect(PUBLIC_PATHS).toEqual(
      expect.arrayContaining(["/privacy", "/terms", "/group/invitations/accept"]),
    );
  });

  it("アプリの認証必須パスではない", () => {
    for (const path of ["/privacy", "/terms"]) {
      expect(isPublicPath(path)).toBe(true);
    }

    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });
});

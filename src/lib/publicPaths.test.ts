import { describe, expect, it } from "vitest";
import { GROUP_INVITATION_ACCEPT_PATH, isPublicPath, PUBLIC_PATHS } from "./publicPaths";

describe("publicPaths", () => {
  it("プライバシーポリシーと招待受け入れを公開パスとして扱う", () => {
    expect(PUBLIC_PATHS).toContain("/privacy");
    expect(PUBLIC_PATHS).toContain(GROUP_INVITATION_ACCEPT_PATH);
  });

  it("isPublicPath で公開パスを判定する", () => {
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath(GROUP_INVITATION_ACCEPT_PATH)).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });
});

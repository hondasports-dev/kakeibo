import { describe, expect, it } from "vitest";
import {
  GROUP_INVITATION_ACCEPT_PATH,
  isAuthenticatedAppPath,
  isPublicPath,
  PUBLIC_PATHS,
  shouldUseRouterBeforeAuth,
} from "./publicPaths";

describe("publicPaths", () => {
  it("プライバシーポリシーと招待受け入れを公開パスとして扱う", () => {
    expect(PUBLIC_PATHS).toContain("/privacy");
    expect(PUBLIC_PATHS).toContain("/terms");
    expect(PUBLIC_PATHS).toContain("/maintenance");
    expect(PUBLIC_PATHS).toContain("/updates");
    expect(PUBLIC_PATHS).toContain(GROUP_INVITATION_ACCEPT_PATH);
  });

  it("isPublicPath で公開パスを判定する", () => {
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/updates")).toBe(true);
    expect(isPublicPath(GROUP_INVITATION_ACCEPT_PATH)).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });

  it("isAuthenticatedAppPath で家計・管理画面を判定する", () => {
    expect(isAuthenticatedAppPath("/")).toBe(true);
    expect(isAuthenticatedAppPath("/years/2026")).toBe(true);
    expect(isAuthenticatedAppPath("/months/2026-08")).toBe(true);
    expect(isAuthenticatedAppPath("/weeks/current/input")).toBe(true);
    expect(isAuthenticatedAppPath("/settings")).toBe(true);
    expect(isAuthenticatedAppPath("/admin/users")).toBe(true);
    expect(isAuthenticatedAppPath("/group/setup")).toBe(true);
    expect(isAuthenticatedAppPath("/__e2e__/ai-expense-queue")).toBe(true);
    expect(isAuthenticatedAppPath("/unknown-page")).toBe(false);
    expect(isAuthenticatedAppPath(GROUP_INVITATION_ACCEPT_PATH)).toBe(false);
  });

  it("shouldUseRouterBeforeAuth で未ログイン時のルーター委譲を判定する", () => {
    expect(shouldUseRouterBeforeAuth("/privacy")).toBe(true);
    expect(shouldUseRouterBeforeAuth("/updates")).toBe(true);
    expect(shouldUseRouterBeforeAuth(GROUP_INVITATION_ACCEPT_PATH)).toBe(true);
    expect(shouldUseRouterBeforeAuth("/unknown-page")).toBe(true);
    expect(shouldUseRouterBeforeAuth("/")).toBe(false);
    expect(shouldUseRouterBeforeAuth("/years/2026")).toBe(false);
    expect(shouldUseRouterBeforeAuth("/months/2026-08")).toBe(false);
    expect(shouldUseRouterBeforeAuth("/weeks/current/input")).toBe(false);
    expect(shouldUseRouterBeforeAuth("/settings")).toBe(false);
    expect(shouldUseRouterBeforeAuth("/group/setup")).toBe(false);
  });
});

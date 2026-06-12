import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { UserIdentity } from "convex/server";
import { buildInvitationRedirectUrl, getInvitationUserIds } from "./groupInvitations";

function createIdentity(): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|user_clerk_001",
    subject: "user_clerk_001",
    issuer: "https://issuer.example",
  };
}

describe("buildInvitationRedirectUrl", () => {
  it("本番ドメインの招待受け入れURLを許可する", () => {
    expect(
      buildInvitationRedirectUrl(
        "https://kakeibo.vercel.app/group/invitations/accept",
        "token-123",
      ),
    ).toBe("https://kakeibo.vercel.app/group/invitations/accept?token=token-123");
  });

  it("Vercel preview の招待受け入れURLを許可する", () => {
    expect(
      buildInvitationRedirectUrl(
        "https://kakeibo-git-main-hondasports-projects.vercel.app/group/invitations/accept",
        "token-456",
      ),
    ).toBe(
      "https://kakeibo-git-main-hondasports-projects.vercel.app/group/invitations/accept?token=token-456",
    );
  });

  it("許可されていない origin は拒否する", () => {
    expect(() =>
      buildInvitationRedirectUrl("https://example.com/group/invitations/accept", "token-789"),
    ).toThrowError(ConvexError);
  });
});

describe("getInvitationUserIds", () => {
  it("アプリDB用IDには tokenIdentifier、Clerk API 用IDには subject を使う", () => {
    expect(getInvitationUserIds(createIdentity())).toEqual({
      appUserId: "https://issuer.example|user_clerk_001",
      clerkUserId: "user_clerk_001",
    });
  });

  it("未認証なら拒否する", () => {
    expect(() => getInvitationUserIds(null)).toThrowError(ConvexError);
  });
});

import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { buildInvitationRedirectUrl } from "./groupInvitations";

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

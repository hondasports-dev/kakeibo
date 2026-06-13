import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  buildClerkInvitationParams,
  buildInvitationRedirectUrl,
  getClerkUserDisplayName,
  getPrimaryVerifiedClerkEmailAddress,
  getVerifiedClerkEmailAddresses,
} from "./groupInvitations";

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

describe("buildClerkInvitationParams", () => {
  it("既存招待または既存ユーザーでも再招待できるよう ignoreExisting を有効にする", () => {
    expect(
      buildClerkInvitationParams(
        "invitee@example.com",
        "https://kakeibo.vercel.app/group/invitations/accept?token=token-123",
        "group-001" as Id<"groups">,
        "token-123",
      ),
    ).toEqual({
      emailAddress: "invitee@example.com",
      redirectUrl: "https://kakeibo.vercel.app/group/invitations/accept?token=token-123",
      ignoreExisting: true,
      publicMetadata: {
        groupId: "group-001",
        token: "token-123",
      },
    });
  });
});

describe("getVerifiedClerkEmailAddresses", () => {
  it("Clerkユーザーの verified なメールだけを正規化して返す", () => {
    expect(
      getVerifiedClerkEmailAddresses({
        emailAddresses: [
          {
            id: "email-primary",
            emailAddress: " Primary@Example.com ",
            verification: { status: "verified" },
          },
          {
            id: "email-unverified",
            emailAddress: "unverified@example.com",
            verification: { status: "unverified" },
          },
          {
            id: "email-missing-verification",
            emailAddress: "missing-verification@example.com",
            verification: null,
          },
        ],
      }),
    ).toEqual(["primary@example.com"]);
  });

  it("verified な primary email をプロフィール表示用メールとして返す", () => {
    expect(
      getPrimaryVerifiedClerkEmailAddress({
        primaryEmailAddressId: "email-primary",
        emailAddresses: [
          {
            id: "email-secondary",
            emailAddress: "secondary@example.com",
            verification: { status: "verified" },
          },
          {
            id: "email-primary",
            emailAddress: "Primary@Example.com",
            verification: { status: "verified" },
          },
        ],
      }),
    ).toBe("primary@example.com");
  });

  it("username があれば表示名として優先し、なければ氏名を結合する", () => {
    expect(
      getClerkUserDisplayName(
        {
          username: "friendly-user",
          firstName: "Taro",
          lastName: "Yamada",
        },
        "fallback@example.com",
      ),
    ).toBe("friendly-user");
    expect(
      getClerkUserDisplayName(
        {
          firstName: "Taro",
          lastName: "Yamada",
        },
        "fallback@example.com",
      ),
    ).toBe("Taro Yamada");
    expect(getClerkUserDisplayName({}, "fallback@example.com")).toBe("fallback@example.com");
  });
});

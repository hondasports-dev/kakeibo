import { describe, expect, it } from "vitest";
import {
  dedupePendingInvitationsByEmail,
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  normalizeGmailAddress,
  sortPendingInvitationsByCreatedAtAndEmail,
  validateEmail,
} from "./email";

describe("validateEmail", () => {
  it("trim して小文字にする", () => {
    expect(validateEmail("  User@Example.COM  ")).toEqual({
      success: true,
      email: "user@example.com",
    });
  });

  it("空文字はエラー", () => {
    expect(validateEmail("   ")).toEqual({ success: false, error: "empty" });
  });
});

describe("normalizeGmailAddress", () => {
  it("Gmail alias を正規化する", () => {
    expect(normalizeGmailAddress("user.name+tag@gmail.com")).toBe("username@gmail.com");
  });

  it("googlemail.com を gmail.com にする", () => {
    expect(normalizeGmailAddress("user@googlemail.com")).toBe("user@gmail.com");
  });

  it("Gmail 以外は null", () => {
    expect(normalizeGmailAddress("user@example.com")).toBeNull();
  });

  it("@ なしは null", () => {
    expect(normalizeGmailAddress("notanemail")).toBeNull();
  });
});

describe("getInvitationEmailKey", () => {
  it("Gmail は canonical address を返す", () => {
    expect(getInvitationEmailKey("User.Name+Tag@Gmail.COM")).toBe("username@gmail.com");
  });

  it("Gmail 以外は trim して小文字", () => {
    expect(getInvitationEmailKey("  User@Example.COM  ")).toBe("user@example.com");
  });
});

describe("sortPendingInvitationsByCreatedAtAndEmail", () => {
  it("createdAt 降順、同じなら email 昇順", () => {
    const invitations = [
      { email: "a@example.com", createdAt: 100 },
      { email: "b@example.com", createdAt: 200 },
      { email: "c@example.com", createdAt: 100 },
    ];
    expect(sortPendingInvitationsByCreatedAtAndEmail(invitations)).toEqual([
      { email: "b@example.com", createdAt: 200 },
      { email: "a@example.com", createdAt: 100 },
      { email: "c@example.com", createdAt: 100 },
    ]);
  });
});

describe("dedupePendingInvitationsByEmail", () => {
  it("Gmail alias を同一視して最新のみ残す", () => {
    const invitations = [
      { email: "user+a@gmail.com", createdAt: 100 },
      { email: "user@Gmail.com", createdAt: 200 },
      { email: "U.S.E.R@Gmail.COM", createdAt: 50 },
      { email: "other@example.com", createdAt: 300 },
    ];
    expect(dedupePendingInvitationsByEmail(invitations)).toEqual([
      { email: "other@example.com", createdAt: 300 },
      { email: "user@Gmail.com", createdAt: 200 },
    ]);
  });
});

describe("invitationEmailsMatch", () => {
  it("そのまま一致", () => {
    expect(invitationEmailsMatch("user@example.com", "user@example.com")).toBe(true);
  });

  it("大文字小文字・空白を無視", () => {
    expect(invitationEmailsMatch("  USER@EXAMPLE.COM  ", "user@example.com")).toBe(true);
  });

  it("Gmail alias も同一視", () => {
    expect(invitationEmailsMatch("user.name+tag@gmail.com", "username@gmail.com")).toBe(true);
  });

  it("undefined なら false", () => {
    expect(invitationEmailsMatch(undefined, "user@example.com")).toBe(false);
  });
});

describe("invitationEmailsMatchAny", () => {
  it("候補のいずれかと一致すれば true", () => {
    expect(
      invitationEmailsMatchAny(["other@example.com", "user@example.com"], "USER@EXAMPLE.COM"),
    ).toBe(true);
  });

  it("一致なしなら false", () => {
    expect(invitationEmailsMatchAny(["a@example.com"], "b@example.com")).toBe(false);
  });
});

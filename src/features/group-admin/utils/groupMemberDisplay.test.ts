import { describe, expect, it } from "vitest";
import {
  getMemberPrimaryLabel,
  getMemberSecondaryLabel,
  isCurrentUserMember,
  type GroupMemberListItem,
} from "./groupMemberDisplay";

const member: GroupMemberListItem = {
  userId: "user-member",
  role: "member",
  displayName: "ユーザー",
  email: "member@example.com",
  createdAt: 1000,
};

describe("groupMemberDisplay", () => {
  it("表示名が未設定ならメールアドレスを主表示に使う", () => {
    expect(getMemberPrimaryLabel(member, null)).toBe("member@example.com");
    expect(getMemberSecondaryLabel(member, "member@example.com")).toBe("メール登録済み");
  });

  it("ログイン中ユーザーには Clerk の表示名を優先する", () => {
    expect(getMemberPrimaryLabel(member, "ログイン 太郎")).toBe("ログイン 太郎");
  });

  it("Clerk userId と tokenIdentifier 形式の両方で自分自身を判定する", () => {
    expect(isCurrentUserMember("https://issuer.example|owner-clerk-id", "owner-clerk-id")).toBe(
      true,
    );
    expect(isCurrentUserMember("owner-clerk-id", "owner-clerk-id")).toBe(true);
    expect(isCurrentUserMember("user-member", "owner-clerk-id")).toBe(false);
  });
});

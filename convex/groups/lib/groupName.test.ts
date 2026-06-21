import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { MAX_GROUP_NAME_LENGTH, normalizeGroupName } from "./groupName";

describe("groupName", () => {
  it("normalizeGroupName は前後の空白を除去する", () => {
    expect(normalizeGroupName(" 鈴木家 ")).toBe("鈴木家");
  });

  it("normalizeGroupName は空文字を拒否する", () => {
    expect(() => normalizeGroupName("   ")).toThrow(ConvexError);
    expect(() => normalizeGroupName("   ")).toThrow("グループ名を入力してください");
  });

  it("normalizeGroupName は長すぎる名前を拒否する", () => {
    expect(() => normalizeGroupName("あ".repeat(MAX_GROUP_NAME_LENGTH + 1))).toThrow(
      `グループ名は${MAX_GROUP_NAME_LENGTH}文字以内で入力してください`,
    );
  });
});

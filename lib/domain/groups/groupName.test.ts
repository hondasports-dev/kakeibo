import { describe, expect, it } from "vitest";
import { MAX_GROUP_NAME_LENGTH, validateGroupName } from "./groupName";

describe("validateGroupName", () => {
  it("前後の空白を除去して成功する", () => {
    const result = validateGroupName(" 鈴木家 ");
    expect(result).toEqual({ success: true, name: "鈴木家" });
  });

  it("空文字を失敗とする", () => {
    const result = validateGroupName("   ");
    expect(result).toEqual({ success: false, error: { type: "empty" } });
  });

  it("最大長を超える名前を失敗とする", () => {
    const result = validateGroupName("あ".repeat(MAX_GROUP_NAME_LENGTH + 1));
    expect(result).toEqual({
      success: false,
      error: { type: "too_long", maxLength: MAX_GROUP_NAME_LENGTH },
    });
  });

  it("最大長ちょうどの名前を成功とする", () => {
    const name = "あ".repeat(MAX_GROUP_NAME_LENGTH);
    const result = validateGroupName(name);
    expect(result).toEqual({ success: true, name });
  });
});

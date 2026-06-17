import { describe, expect, it } from "vitest";
import { getConvexErrorMessage } from "./convexError";

describe("getConvexErrorMessage", () => {
  it("Error.message を優先する", () => {
    expect(getConvexErrorMessage(new Error("サーバーエラー"), "フォールバック")).toBe(
      "サーバーエラー",
    );
  });

  it("message が空ならフォールバックを返す", () => {
    expect(getConvexErrorMessage(new Error("   "), "フォールバック")).toBe("フォールバック");
  });
});

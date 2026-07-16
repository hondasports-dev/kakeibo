import { describe, expect, it } from "vitest";
import { assertGroupNotDeleted, isGroupDeleted } from "./groupLifecycle";

describe("group lifecycle", () => {
  it("deleting のグループを通常利用不能として扱う", () => {
    const deletingGroup = { status: "deleting" as never };

    expect(isGroupDeleted(deletingGroup)).toBe(true);
    expect(() => assertGroupNotDeleted(deletingGroup)).toThrow(
      "削除済みのグループにはアクセスできません",
    );
  });
});

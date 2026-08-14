import { describe, expect, it } from "vitest";
import { sanitizeGroupDeletionErrorCategory } from "./groupDeletion";

describe("sanitizeGroupDeletionErrorCategory", () => {
  it("既知のカテゴリはそのまま返す", () => {
    expect(sanitizeGroupDeletionErrorCategory("batch_processing_failed")).toBe(
      "batch_processing_failed",
    );
    expect(sanitizeGroupDeletionErrorCategory("unknown")).toBe("unknown");
  });

  it("未知のカテゴリは unknown にする", () => {
    expect(sanitizeGroupDeletionErrorCategory("unexpected")).toBe("unknown");
  });

  it("undefined は undefined のまま", () => {
    expect(sanitizeGroupDeletionErrorCategory(undefined)).toBeUndefined();
  });
});

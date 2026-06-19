import { describe, expect, it } from "vitest";
import { formatDateForDisplay } from "./dateFormat";

describe("formatDateForDisplay", () => {
  it("ISO形式の日付を M/D 形式にフォーマットする", () => {
    expect(formatDateForDisplay("2026-05-18")).toBe("5/18");
  });

  it("1月1日を正しくフォーマットする", () => {
    expect(formatDateForDisplay("2026-01-01")).toBe("1/1");
  });

  it("12月31日を正しくフォーマットする", () => {
    expect(formatDateForDisplay("2026-12-31")).toBe("12/31");
  });

  it("1桁の月・日でもゼロパディングなしでフォーマットする", () => {
    expect(formatDateForDisplay("2026-03-05")).toBe("3/5");
  });
});

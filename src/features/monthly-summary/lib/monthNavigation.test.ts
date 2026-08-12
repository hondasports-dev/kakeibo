import { describe, expect, it } from "vitest";
import { addMonths, formatMonthLabel, normalizeMonth } from "./monthNavigation";

describe("monthNavigation", () => {
  it("前月・次月を算出する", () => {
    expect(addMonths("2026-08", -1)).toBe("2026-07");
    expect(addMonths("2026-08", 1)).toBe("2026-09");
  });

  it("不正なURLパラメータは正規化できない", () => {
    expect(normalizeMonth("2026-13")).toBeNull();
  });

  it("年月表示を作る", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026年8月");
  });
});

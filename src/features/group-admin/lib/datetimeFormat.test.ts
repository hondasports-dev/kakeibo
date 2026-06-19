import { describe, expect, it } from "vitest";
import { formatDateTimeForDisplay } from "./datetimeFormat";

describe("formatDateTimeForDisplay", () => {
  it("Unix タイムスタンプを日本語の日時表記に変換する", () => {
    const timestamp = Date.UTC(2026, 0, 15, 3, 30);
    expect(formatDateTimeForDisplay(timestamp)).toMatch(/2026/);
    expect(formatDateTimeForDisplay(timestamp)).toMatch(/15/);
  });
});

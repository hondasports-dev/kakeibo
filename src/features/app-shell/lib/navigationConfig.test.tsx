import { describe, expect, it } from "vitest";
import { getCurrentWeekStartDate } from "../../week";
import { createNavItems, getBottomNavValue, isNavItemSelected } from "./navigationConfig";

describe("navigationConfig", () => {
  it("支出関連の履歴ページでは履歴タブを選択する", () => {
    const navItems = createNavItems();
    const historyIndex = navItems.findIndex((item) => item.label === "履歴");

    expect(getBottomNavValue("/search", navItems)).toBe(historyIndex);
    expect(getBottomNavValue("/months/2026-08", navItems)).toBe(historyIndex);
    expect(isNavItemSelected("/search", "/")).toBe(false);
    expect(isNavItemSelected("/search", navItems[historyIndex]?.path ?? "")).toBe(true);
    expect(isNavItemSelected("/months/2026-08", navItems[historyIndex]?.path ?? "")).toBe(true);
    expect(isNavItemSelected("/weeks/current/input", navItems[historyIndex]?.path ?? "")).toBe(
      false,
    );
  });

  it("履歴タブの週次リンクにユーザーの週開始曜日を反映する", () => {
    const navItems = createNavItems(3);
    const historyItem = navItems.find((item) => item.label === "履歴");

    expect(historyItem?.path).toBe(`/weeks/${getCurrentWeekStartDate(3)}`);
  });
});

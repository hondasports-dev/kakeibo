import { describe, expect, it } from "vitest";
import { createNavItems, getBottomNavValue, isNavItemSelected } from "./navigationConfig";

describe("navigationConfig", () => {
  it("支出検索ページではボトムナビを未選択にする", () => {
    const navItems = createNavItems();
    expect(getBottomNavValue("/search", navItems)).toBe(false);
    expect(isNavItemSelected("/search", "/")).toBe(false);
  });
});

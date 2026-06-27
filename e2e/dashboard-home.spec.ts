import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * Issue #370 ホーム画面拡充 E2E
 *
 * カバーするシナリオ:
 *   - PC: サマリー3指標 + 前週比較 + 2カラム
 *   - SP: 要素順（入力パネルがカテゴリより上）
 */

test.describe("ホーム画面拡充（Issue #370）", () => {
  test("[Issue #370] PC幅でサマリー指標と前週比較が表示される", async ({ page }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole("heading", { name: "今週のダッシュボード" })).toBeVisible();
    await expect(page.getByText("今週の支出")).toBeVisible();
    await expect(page.getByText("入力済み", { exact: true })).toBeVisible();
    await expect(page.getByLabel("前週比").first()).toBeVisible();
    await expect(page.getByLabel("前週比").first()).toContainText(/%|前週データなし/);
    await expect(page.getByRole("heading", { name: "前週との比較", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "支出カテゴリ", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今週の入力", level: 2 })).toBeVisible();
    await expect(page.locator(".dashboard-grid")).toBeVisible();
    await expect(page.getByRole("link", { name: "今週のサマリーを見る ›" })).toBeVisible();
  });

  test("[Issue #370] SP幅で入力パネルがカテゴリより上に表示される", async ({ page }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const resumeButton = page
      .getByRole("link", { name: "入力を再開" })
      .or(page.getByRole("link", { name: "今週の入力を開始" }));
    const categoryHeading = page.getByRole("heading", { name: "支出カテゴリ", level: 2 });

    await expect(resumeButton.first()).toBeVisible();
    await expect(categoryHeading).toBeVisible();

    const inputBox = await resumeButton.first().boundingBox();
    const categoryBox = await categoryHeading.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(inputBox!.y).toBeLessThan(categoryBox!.y);
  });

  test("[Issue #370] SP幅で今週のサマリー導線が下部に表示される", async ({ page }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole("link", { name: "今週のサマリーを見る" })).toBeVisible();
  });
});

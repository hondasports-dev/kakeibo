import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * レスポンシブ表示 E2E テスト
 *
 * Issue #20「MVPレスポンシブ確認」の受け入れ確認。
 *
 * カバーするシナリオ:
 *   - シナリオ R-1: 390px viewport でメイン画面の主要要素が表示される (P1 / smoke)
 *   - シナリオ R-2: 320px viewport でメイン画面の主要要素が表示される (P1 / smoke)
 *   - シナリオ R-3: 390px viewport でカテゴリ設定画面の主要要素が表示される (P1 / smoke)
 *
 * テストデータ・cleanup:
 *   - レシート・カテゴリを作成しないため cleanup 不要。
 */

test.describe("レスポンシブ表示（Issue #20）", () => {
  test("@smoke シナリオR-1: 390px viewport でメイン画面の主要要素が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole("heading", { name: "今週のレシート入力" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "レシートを追加" })).toBeVisible();
    await expect(page.locator('[class*="user-menu-button"]')).toBeVisible();
  });

  test("@smoke シナリオR-2: 320px viewport でメイン画面の主要要素が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 320, height: 568 });

    await expect(page.getByRole("heading", { name: "今週のレシート入力" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "レシートを追加" })).toBeVisible();
    await expect(page.locator('[class*="user-menu-button"]')).toBeVisible();
  });

  test("@smoke シナリオR-3: 390px viewport でカテゴリ設定画面の主要要素が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // カテゴリ設定ボタンをクリックして画面切り替え
    await page.getByRole("button", { name: "カテゴリ設定" }).click();

    await expect(page.getByRole("heading", { name: "カテゴリ設定" })).toBeVisible();
    // カテゴリ行が少なくとも1件表示されることを確認
    await expect(page.locator('[class*="category-settings-row"]').first()).toBeVisible();
  });
});

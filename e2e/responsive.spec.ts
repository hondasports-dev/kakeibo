import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * レスポンシブ表示 E2E テスト
 *
 * Issue #20「MVPレスポンシブ確認」の受け入れ確認。
 *
 * カバーするシナリオ:
 *   - ~~シナリオ R-1: 390px viewport でメイン画面の主要要素が表示される (P1 / smoke)~~
 *     **削除** (Issue #49 でダッシュボードが変更されたため)
 *   - ~~シナリオ R-2: 320px viewport でメイン画面の主要要素が表示される (P1 / smoke)~~
 *     **削除** (Issue #49 でダッシュボードが変更されたため)
 *   - シナリオ R-3: 390px viewport でカテゴリ設定画面の主要要素が表示される (P1 / smoke)
 *     **更新** (BottomNavigation 経由の遷移に変更)
 *
 * テストデータ・cleanup:
 *   - レシート・カテゴリを作成しないため cleanup 不要。
 */

test.describe("レスポンシブ表示（Issue #20）", () => {
  test("@smoke シナリオR-3: 390px viewport でカテゴリ設定画面の主要要素が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationの「設定」タブをクリックして /settings に遷移
    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");

    // 設定画面の見出しが表示されることを確認
    await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();
  });
});

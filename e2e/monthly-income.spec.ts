import { expect, test } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupTestReceipts, cleanupUserMonthlyIncome } from "./helpers/cleanup";
import { clickUserMenuItem } from "./helpers/ui";

/**
 * 月収入設定と当月残金表示 E2E テスト
 *
 * Issue #48「月収入設定と当月残金表示機能」の受け入れ確認。
 *
 * カバーするシナリオ:
 *   - @smoke 月収入未設定時に残金プロンプトが表示される (P0)
 *   - @smoke 月収入を設定すると残金が表示される (P0)
 */

test.beforeEach(async () => {
  // 各テストを独立させるため、事前に月収入をクリアしておく
  await cleanupUserMonthlyIncome();
});

test.afterEach(async () => {
  await cleanupTestReceipts();
  await cleanupUserMonthlyIncome();
});

test("@smoke 月収入未設定時に残金プロンプトが表示される", async ({ page }) => {
  // Given: 月収入が未設定の状態でダッシュボードに移動
  await gotoAuthenticated(page);

  // When: ダッシュボードを確認する
  // Then: 月収入未設定時のプロンプトが表示される
  await expect(page.locator("text=収入を設定すると残金が確認できます")).toBeVisible();
});

test("@smoke 月収入を設定すると残金が表示される", async ({ page }) => {
  // Given: ダッシュボードに移動
  await gotoAuthenticated(page);

  // メインUIが完全にレンダリングされるまで待機
  await page.locator('[class*="user-menu-button"]').waitFor({ state: "visible", timeout: 15_000 });

  // When: ユーザーメニューを開いて「ユーザー設定」をクリック
  // Issue #49: 「ユーザー設定」は /settings ページに遷移する
  await clickUserMenuItem(page, "ユーザー設定");
  await expect(page).toHaveURL("/settings");

  // And: 月収入を入力して保存する
  const monthlyIncomeInput = page.getByLabel("月収入（円）");
  const saveButton = page.getByRole("button", { name: "保存" });

  // profile のロード完了を待つ（ロード中は保存ボタンが disabled）
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });

  await monthlyIncomeInput.fill("300000");
  await expect(monthlyIncomeInput).toHaveValue("300000");
  await saveButton.click();

  // Then: 保存完了のSnackbarが表示される
  await expect(page.locator("text=月収入を保存しました")).toBeVisible();

  // ダッシュボードに戻って残金を確認する
  await page.getByRole("link", { name: "ホーム" }).click();
  await expect(page).toHaveURL("/");

  // Then: ダッシュボードに残金が表示される（「円」を含む）
  // Convex subscription の更新を待つため timeout を長めに設定する
  await expect(
    page.locator(".summary-grid").locator("text=今月の残金").locator("..").locator(".."),
  ).toContainText("円", { timeout: 20_000 });
});

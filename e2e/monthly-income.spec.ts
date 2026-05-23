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
  await clickUserMenuItem(page, "ユーザー設定");

  // And: 月収入を入力して保存する
  await page.getByLabel("月収入（円）").fill("300000");
  await page.getByRole("button", { name: "保存" }).click();

  // Then: 保存完了のSnackbarが表示される
  await expect(page.locator("text=月収入を保存しました")).toBeVisible();

  // Then: ダッシュボードに残金が表示される（「円」を含む）
  // ダイアログを閉じる前に確認する（Convex subscription はダイアログが開いていても更新される）
  // Convex subscription の更新を待つため timeout を長めに設定する
  await expect(
    page.locator(".summary-grid").locator("text=今月の残金").locator("..").locator(".."),
  ).toContainText("円", { timeout: 20_000 });

  // And: ダイアログを閉じる
  await page.keyboard.press("Escape");

  // ダイアログが完全に閉じるのを待機（Dialog の [role="dialog"] が消えるまで）
  await page.locator('[role="dialog"]').waitFor({ state: "hidden", timeout: 5_000 });
});

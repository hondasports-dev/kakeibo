import { expect, test } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupTestReceipts, cleanupUserMonthlyIncome } from "./helpers/cleanup";

/**
 * 月収入設定と当月残金表示 E2E テスト
 *
 * Issue #48「月収入設定と当月残金表示機能」の受け入れ確認。
 * Issue #79: UserSettingsPanel（月収入設定UI）を削除したため、
 *   「月収入を設定すると残金が表示される」シナリオは削除済み。
 *
 * カバーするシナリオ:
 *   - @smoke 月収入未設定時に残金プロンプトが表示される (P0)
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

import { test } from "@playwright/test";
import { cleanupTestReceipts, cleanupUserMonthlyIncome } from "./helpers/cleanup";

/**
 * 月収入設定と当月残金表示 E2E テスト
 *
 * Issue #48「月収入設定と当月残金表示機能」の受け入れ確認。
 * Issue #79: UserSettingsPanel（月収入設定UI）を削除したため、
 *   月収入設定 E2E テストは削除済み。
 *
 * カバーするシナリオ:
 *   - ~~@smoke 月収入未設定時に残金プロンプトが表示される~~
 *     **削除** (Issue #79 で月収入設定 UI を削除したため、プロンプト自体も削除)
 */

test.beforeEach(async () => {
  // 各テストを独立させるため、事前に月収入をクリアしておく
  await cleanupUserMonthlyIncome();
});

test.afterEach(async () => {
  await cleanupTestReceipts();
  await cleanupUserMonthlyIncome();
});

// Issue #79 で月収入設定 UI を削除したため、E2E テストはなし
// 今月の残金機能は Convex データ（users.monthlyIncome）が残存するため、
// 将来の復旧は可能だが、UI からの設定手段は削除済み

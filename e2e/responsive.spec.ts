import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import {
  expectLocatorInsideViewport,
  expectLocatorLeftInsideViewport,
  expectNoHorizontalOverflow,
} from "./helpers/viewport";

/** Issue #354 スクショ相当の SP 幅 */
const MOBILE_VIEWPORT = { width: 406, height: 687 };

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
 *   - シナリオ R-3: 390px viewport で設定画面の主要要素が表示される (P1 / smoke)
 *     **更新** (BottomNavigation 経由の遷移に変更)
 *   - シナリオ R-4: 406px viewport で入力画面が横スクロールせず主要要素が viewport 内に収まる (P1 / smoke)
 *     Issue #354 対応
 *
 * テストデータ・cleanup:
 *   - レシート・カテゴリを作成しないため cleanup 不要。
 */

test.describe("レスポンシブ表示（Issue #20）", () => {
  test("@smoke シナリオR-3: 390px viewport で設定画面の主要要素が表示される", async ({ page }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });

    // BottomNavigationの「設定」タブをクリックして /settings に遷移
    await page.getByRole("link", { name: "設定" }).click();
    await expect(page).toHaveURL("/settings");

    // 設定画面の見出しが表示されることを確認
    await expect(page.getByRole("heading", { name: "設定", level: 1 })).toBeVisible();
  });

  test("@smoke シナリオR-4: 406px viewport で入力画面が横スクロールせず主要要素が表示される", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page
      .getByRole("navigation", { name: "ボトムナビゲーション" })
      .getByRole("link", { name: "入力" })
      .click();
    await expect(page).toHaveURL("/weeks/current/input");

    await expect(page.getByRole("heading", { name: "入力", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "レシート入力" })).toBeVisible();
    const queueSection = page.locator("section.ai-expense-queue");
    const addReceiptButton = queueSection.getByRole("button", { name: "レシートを追加" }).first();
    const cameraButton = queueSection.getByRole("button", { name: "撮影する" });
    await expect(addReceiptButton).toBeVisible();
    await expect(cameraButton).toBeVisible();

    const shopNameInput = page.getByLabel("店舗名 / 支払先");
    const amountInput = page.getByLabel("合計金額");
    const categoryList = page.getByRole("listbox", { name: "カテゴリ候補" });
    const saveButton = page.getByRole("button", { name: "保存して次へ" });
    await expect(shopNameInput).toBeVisible();
    await expect(amountInput).toBeVisible();
    await expect(categoryList).toBeVisible();
    await expect(saveButton).toBeVisible();

    // ページ遷移アニメーション（300ms）完了後に横スクロールと viewport 内収容を確認
    await page.waitForTimeout(400);

    await expectNoHorizontalOverflow(page);
    await expectLocatorInsideViewport(queueSection);
    await expectLocatorInsideViewport(addReceiptButton);
    await expectLocatorInsideViewport(cameraButton);
    await expectLocatorInsideViewport(shopNameInput);
    await expectLocatorInsideViewport(amountInput);
    await expectLocatorInsideViewport(categoryList);
    await expectLocatorInsideViewport(saveButton);
    await expectLocatorLeftInsideViewport(saveButton);
  });

  test("@smoke シナリオR-4b: 406px viewport でキュー有データ時も主要要素が viewport 内に収まる", async ({
    page,
  }) => {
    await gotoAuthenticated(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/__e2e__/ai-expense-queue");

    const queueSection = page.locator("section.ai-expense-queue");
    const statusSummary = page.locator(".ai-expense-queue-status-summary");
    const addReceiptButton = queueSection.getByRole("button", { name: "レシートを追加" }).first();
    const cameraButton = queueSection.getByRole("button", { name: "撮影する" });
    const failedChip = queueSection.getByText("失敗 1件");

    await expect(queueSection).toBeVisible();
    await expect(statusSummary).toBeVisible();
    await expect(addReceiptButton).toBeVisible();
    await expect(cameraButton).toBeVisible();
    await expect(failedChip).toBeVisible();
    await expect(queueSection.getByText("登録準備OK 1件")).toBeVisible();
    await expect(queueSection.getByText("確認が必要 1件")).toBeVisible();

    await page.waitForTimeout(400);

    await expectNoHorizontalOverflow(page);
    await expectLocatorInsideViewport(queueSection);
    await expectLocatorInsideViewport(statusSummary);
    await expectLocatorInsideViewport(addReceiptButton);
    await expectLocatorInsideViewport(cameraButton);
    await expectLocatorInsideViewport(failedChip);
  });
});

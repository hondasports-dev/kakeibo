import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { clickUserMenuItem } from "./helpers/ui";

/**
 * 認証フロー E2E テスト
 *
 * カバーするシナリオ:
 *   - シナリオ 1: 未ログイン状態でアクセス → ログイン画面が表示される (P0)
 *     ※ Clerk Testing Token 方式と構造的に非互換のためスキップ
 *     ※ global-setup の clerkSetup() が CLERK_TESTING_TOKEN を process.env にセットするため、
 *     ※ storageState を空にしても Testing Token がリクエストに付与され Clerk の初期化が不安定になる。
 *   - シナリオ 4: ログアウト → ログイン画面に戻る (P1)
 */

// test.describe('未ログイン状態', () => {
//   // storageState を空にして未ログイン状態を強制する
//   test.use({ storageState: { cookies: [], origins: [] } })
//
//   test('シナリオ1: アクセスするとログイン画面が表示される', async ({ page }) => {
//     await page.goto('/')
//     await page.waitForFunction(
//       () => {
//         const w = window as Window & { Clerk?: { loaded?: boolean } }
//         return w.Clerk?.loaded === true
//       },
//       { timeout: 30_000 },
//     )
//     await expect(page.getByRole('heading', { name: '家計簿にログイン' })).toBeVisible()
//     await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
//     await expect(page.getByRole('alert')).toContainText(
//       'Clerkの開発用テストユーザーではGoogle OAuthにログインできません',
//     )
//   })
// })

/**
 * ログアウトテスト
 * gotoAuthenticated でログイン状態を作り、ログアウト後の状態を確認する。
 */
test.describe("ログアウト", () => {
  test("シナリオ4: ログアウトするとログイン画面に戻る", async ({ page }) => {
    await gotoAuthenticated(page);
    await expect(page.locator("text=今週のレシート入力")).toBeVisible();

    // ユーザーメニューを開いてログアウト
    await clickUserMenuItem(page, "ログアウト");

    // ログイン画面に戻ることを確認
    await expect(page.getByRole("heading", { name: "家計簿にログイン" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
  });
});

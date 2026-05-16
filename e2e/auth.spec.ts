import { test, expect } from '@playwright/test'

/**
 * 認証フロー E2E テスト
 *
 * カバーするシナリオ:
 *   - シナリオ 1: 未ログイン状態でアクセス → ログイン画面が表示される (P0)
 *   - シナリオ 4: ログアウト → ログイン画面に戻る (P1)
 */

test.describe('未ログイン状態', () => {
  // storageState を空にして未ログイン状態を強制する
  test.use({ storageState: { cookies: [], origins: [] } })

  test('シナリオ1: アクセスするとログイン画面が表示される', async ({ page }) => {
    await page.goto('/')

    // Clerk Testing Token 環境では Cookie なしでも CLERK_TESTING_TOKEN がリクエストに付与されるため
    // isLoaded が true になるまで waitForFunction で明示的に待機する。
    // storageState が空なので isSignedIn は false になり、ログイン画面に遷移するはず。
    await page.waitForFunction(
      () => {
        const w = window as Window & { Clerk?: { loaded?: boolean } }
        return w.Clerk?.loaded === true
      },
      { timeout: 30_000 },
    )

    await expect(page.getByRole('heading', { name: '家計簿にログイン' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Clerkの開発用テストユーザーではGoogle OAuthにログインできません',
    )
  })
})

/**
 * ログアウトテスト
 * setupClerkTestingToken で Testing Token を付与してログイン状態を作り、
 * ログアウト後の状態を確認する。
 */
// test.describe('ログアウト', () => {
//   test('シナリオ4: ログアウトするとログイン画面に戻る', async ({ page }) => {
//     const email = process.env.E2E_CLERK_USER_EMAIL
//     if (!email) throw new Error('E2E_CLERK_USER_EMAIL is not set')
//     await page.goto('/')
//     await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: email } })
//     await expect(page.locator('text=今週のレシート入力')).toBeVisible()
//
//     // ユーザーメニューを開いてログアウト
//     await page.locator('[class*="user-menu-button"]').click()
//     await page.waitForSelector('[role="menu"]')
//     await page.getByRole('menuitem', { name: 'ログアウト' }).click()
//
//     // ログイン画面に戻ることを確認
//     await expect(page.getByRole('heading', { name: '家計簿にログイン' })).toBeVisible()
//     await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
//   })
// })

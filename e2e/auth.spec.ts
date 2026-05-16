import { test, expect } from '@playwright/test'

/**
 * 認証フロー E2E テスト
 *
 * カバーするシナリオ:
 *   - シナリオ 1: 未ログイン状態でアクセス → ログイン画面が表示される (P0)
 *   - シナリオ 4: ログアウト → ログイン画面に戻る (P1)
 *
 * 注意: このファイルは storageState を「使わない」テスト用。
 *       ログイン済みテストは receipt-form.spec.ts を参照。
 */

// storageState を持ち込まない（未ログイン状態をテストするため）
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('未ログイン状態', () => {
  test('シナリオ1: アクセスするとログイン画面が表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=家計簿にログイン')

    await expect(page.getByRole('heading', { name: '家計簿にログイン' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Clerkの開発用テストユーザーではGoogle OAuthにログインできません',
    )
  })
})

/**
 * ログアウトテスト
 * storageState（ログイン済み）を使ってログアウト後の状態を確認する。
 */
test.use({ storageState: 'playwright/.clerk/user.json' })

test.describe('ログアウト', () => {
  test('シナリオ4: ログアウトするとログイン画面に戻る', async ({ page }) => {
    const { setupClerkTestingToken } = await import('@clerk/testing/playwright')
    await setupClerkTestingToken({ page })
    await page.goto('/')
    await expect(page.locator('text=今週のレシート入力')).toBeVisible()

    // ユーザーメニューを開いてログアウト
    await page.locator('[class*="user-menu-button"]').click()
    await page.waitForSelector('[role="menu"]')
    await page.getByRole('menuitem', { name: 'ログアウト' }).click()

    // ログイン画面に戻ることを確認
    await expect(page.getByRole('heading', { name: '家計簿にログイン' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
  })
})

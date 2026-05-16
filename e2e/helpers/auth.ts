import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

/**
 * Clerk ボット検出をバイパスして認証済みページに遷移するヘルパー。
 * ログイン済み状態（storageState）のテストで使用する。
 *
 * @param page - Playwright の Page オブジェクト
 * @param path - 遷移先パス（デフォルト: '/'）
 */
export async function gotoAuthenticated(page: Page, path = '/') {
  await setupClerkTestingToken({ page })
  await page.goto(path)
}

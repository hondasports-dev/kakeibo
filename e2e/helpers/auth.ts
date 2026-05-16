import { clerk } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

/**
 * Clerk Testing Token でサインインしてページに遷移する認証ヘルパー。
 *
 * clerk.signIn は内部で次の処理を行う:
 *   1. setupClerkTestingToken でルートハンドラーを登録（ボット検出バイパス）
 *   2. page.goto(baseURL) で Clerk がロードされるまで待機
 *   3. CLERK_SECRET_KEY で signInToken を発行し ticket ストラテジーでサインイン
 *
 * 必要な環境変数:
 *   E2E_CLERK_USER_EMAIL, CLERK_SECRET_KEY
 *
 * @param page - Playwright の Page オブジェクト
 * @param path - サインイン後に遷移するパス（デフォルト: '/'）
 */
export async function gotoAuthenticated(page: Page, path = '/') {
  const email = process.env.E2E_CLERK_USER_EMAIL
  if (!email) throw new Error('E2E_CLERK_USER_EMAIL is not set')

  // clerk.signIn は window.Clerk のロードを待つため、事前に page.goto が必要
  await page.goto('/')
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: email } })
  if (path !== '/') await page.goto(path)
}

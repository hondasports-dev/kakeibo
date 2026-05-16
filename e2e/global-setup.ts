import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'

/**
 * Playwright グローバルセットアップ
 *
 * Clerk Testing Token を取得し、全テストで再利用できるようにする。
 * project-based setup として実行されるため、環境変数がテストワーカーに正しく伝播される。
 *
 * 必要な環境変数（.env.local に設定）:
 *   CLERK_PUBLISHABLE_KEY=pk_test_...  ← VITE_CLERK_PUBLISHABLE_KEY と同じ値を設定
 *   CLERK_SECRET_KEY=sk_test_...
 *   E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
 *   E2E_CLERK_USER_PASSWORD=<secure-password>
 *
 * テストユーザー作成コマンド（初回のみ）:
 *   pnpm exec clerk users create \
 *     --instance dev \
 *     --email "codex+clerk_test@example.com" \
 *     --password "<secure-password>" \
 *     --first-name Codex \
 *     --last-name Test \
 *     --yes
 *
 * 詳細: docs/e2e-test-cases.md、docs/development-process.md「Codex 開発時の Clerk 認証」
 */

// Setup は serial で実行（並列実行による競合を防ぐ）
setup.describe.configure({ mode: 'serial' })

setup('global setup', async () => {
  await clerkSetup()
})

/**
 * E2E テストデータクリーンアップヘルパー
 *
 * テスト中に Convex Dev DB に作成したレシートを afterEach で削除し、
 * 共有 Dev DB にゴミが溜まるのを防ぐ。
 *
 * 仕組み:
 *   Convex HTTP エンドポイント（POST /e2e/cleanup）を呼び出し、
 *   テストユーザーのレシートを全件削除する。
 *
 * 必要な環境変数:
 *   VITE_CONVEX_SITE_URL  — Convex HTTP エンドポイントのベース URL
 *                           例: https://hardy-mockingbird-708.convex.site
 *   E2E_CLEANUP_SECRET    — Convex 側の E2E_CLEANUP_SECRET 環境変数と同じ値
 *   E2E_CLERK_USER_ID     — テストユーザーの Clerk tokenIdentifier
 *                           例: https://xxx.clerk.accounts.dev|user_xxxxxx
 *
 * セットアップ:
 *   1. Convex Dashboard > Settings > Environment Variables に
 *      E2E_CLEANUP_SECRET=<任意のランダム文字列> を追加する。
 *   2. .env.local（ローカル）と GitHub Secrets（CI）に同じ値を設定する。
 *   3. E2E_CLERK_USER_ID は Clerk Dashboard > Users でテストユーザーの
 *      User ID を確認し、"https://<your-domain>.clerk.accounts.dev|<user_id>" の
 *      形式で設定する（AGENTS.md の「E2E クリーンアップ設定」参照）。
 */

/**
 * テストユーザーのレシートを全件削除する。
 *
 * 環境変数が未設定の場合は警告のみ出してスキップする（ローカル開発の利便性のため）。
 * CI 環境（process.env.CI === 'true'）では未設定の場合にエラーをスローする。
 */
export async function cleanupTestReceipts(): Promise<void> {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL
  const secret = process.env.E2E_CLEANUP_SECRET
  const userId = process.env.E2E_CLERK_USER_ID

  if (!siteUrl || !secret || !userId) {
    if (process.env.CI) {
      throw new Error(
        'E2E クリーンアップに必要な環境変数が未設定です。' +
        'VITE_CONVEX_SITE_URL, E2E_CLEANUP_SECRET, E2E_CLERK_USER_ID を設定してください。',
      )
    }
    // ローカルでは警告のみ（未設定でもテストは続行できる）
    console.warn(
      '[cleanup] VITE_CONVEX_SITE_URL / E2E_CLEANUP_SECRET / E2E_CLERK_USER_ID が未設定のため' +
      'クリーンアップをスキップします。',
    )
    return
  }

  const res = await fetch(`${siteUrl}/e2e/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-E2E-Cleanup-Secret': secret,
    },
    body: JSON.stringify({ userId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`E2E クリーンアップに失敗しました: ${res.status} ${text}`)
  }

  const data = await res.json() as { deletedCount: number }
  if (data.deletedCount > 0) {
    console.log(`[cleanup] ${data.deletedCount} 件のレシートを削除しました。`)
  }
}

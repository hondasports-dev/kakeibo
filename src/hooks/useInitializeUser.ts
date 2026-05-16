import { useEffect, useRef } from 'react'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Convex 認証確立後に users テーブルを upsert し、デフォルトカテゴリを seed するフック。
 *
 * 使い方:
 *   認証済みユーザーのみアクセスできるコンポーネントのトップレベルで呼び出す。
 *   例: <KakeiboApp /> の直下など。
 *
 * - Convex 認証が確立された直後に 1 回だけ upsertUser を呼ぶ。
 * - upsertUser 完了後に seedDefaultCategories を呼び出す。
 * - userId はサーバー側で identity.tokenIdentifier から解決するため、
 *   クライアントから userId を渡さない。
 * - エラーは console.error に記録し、UI をブロックしない。
 */
export function useInitializeUser() {
  const { isAuthenticated } = useConvexAuth()
  const upsertUser = useMutation(api.users.upsertUser)
  const seedDefaultCategories = useMutation(api.categories.seedDefaultCategories)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    upsertUser()
      .then(() => seedDefaultCategories())
      .then(() => {
        hasInitialized.current = true
      })
      .catch((err: unknown) => {
        hasInitialized.current = false // リトライ許可
        console.error('[useInitializeUser] initialization failed:', err)
      })
  }, [isAuthenticated, upsertUser, seedDefaultCategories])
}

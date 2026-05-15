import { useEffect, useRef } from 'react'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Convex 認証確立後に users テーブルを upsert するフック。
 *
 * 使い方:
 *   認証済みユーザーのみアクセスできるコンポーネントのトップレベルで呼び出す。
 *   例: <KakeiboApp /> の直下など。
 *
 * - Convex 認証が確立された直後に 1 回だけ upsertUser を呼ぶ。
 * - userId はサーバー側で identity.tokenIdentifier から解決するため、
 *   クライアントから userId を渡さない。
 * - エラーは console.error に記録し、UI をブロックしない。
 */
export function useInitializeUser() {
  const { isAuthenticated } = useConvexAuth()
  const upsertUser = useMutation(api.users.upsertUser)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    upsertUser().catch((err: unknown) => {
      console.error('[useInitializeUser] upsertUser failed:', err)
    })
  }, [isAuthenticated, upsertUser])
}

# 認証ガード適用方針

このドキュメントは、kakeibo プロジェクトにおける Clerk + Convex 認証の適用方針を定義します。

## 全体方針

Clerk Restricted mode はアプリへの入口制限（招待制ユーザー管理）であり、
Convex データへの認可とは別の仕組みです。
Convex 側では必ず `ctx.auth.getUserIdentity()` を使い、
未認証の場合は query / mutation / action を拒否します。

## Convex 側の認証・認可

### 基本ルール

| ルール           | 詳細                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| 認証確認         | すべての query / mutation で `ctx.auth.getUserIdentity()` を呼ぶ                 |
| 未認証拒否       | `identity === null` の場合は `ConvexError("Not authenticated")` をスローする     |
| 認可キー         | `identity.tokenIdentifier` を優先する（`subject` は使わない）                    |
| userId の解決    | クライアント引数を信用せず、サーバー側で `identity.tokenIdentifier` から解決する |
| データ所有者分離 | receipt / category / weekSession などの家計データは `userId` で所有者を分離する  |

### 共通ヘルパー（`convex/users/auth.ts`）

```typescript
// 未認証時は ConvexError をスロー、認証時は tokenIdentifier を返す
export async function requireAuthenticatedUserId(ctx: AuthContext): Promise<string>

// identity から AuthState を生成する純粋関数（query の返り値作成に使う）
export function getAuthStateFromIdentity(identity: UserIdentity | null): AuthState

// ログイン後に呼び出す mutation。users テーブルを upsert する
export const upsertUser = mutation({ args: {}, handler: async (ctx) => { ... } })
```

### query / mutation での使用例

```typescript
import { requireAuthenticatedUserId } from "./users/auth";

export const listReceipts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthenticatedUserId(ctx);
    return await ctx.db
      .query("receipts")
      .withIndex("by_user_id_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});
```

### システム管理者の認可

システム管理者向け query / mutation は、通常ユーザー向けの認証ヘルパーに加えて
`requireSystemAdmin(ctx)` を入口で実行する。`systemAdmins` の active record だけを許可し、
クライアント引数、Clerk metadata、メールアドレスを権限根拠にしない。

この認可は家計データのグループ認可を置き換えない。詳細は
`docs/system-admin-authorization.md` を参照する。

## フロントエンド側の認証ガード

### Provider 構成（`src/main.tsx`）

```
ClerkProvider
  └── ConvexProviderWithClerk   ← Clerk JWT を Convex リクエストに付与
        └── ThemeProvider
              └── App
```

`ConvexProviderWithClerk` が Clerk の JWT を自動的に Convex リクエストに付与します。

### 認証状態のチェック順序（`AuthenticatedApp` コンポーネント）

1. `useAuth().isLoaded` が `false` → ローディング表示
2. `useAuth().isSignedIn` が `false` → サインイン画面（`SignedOutScreen`）
3. `useConvexAuth().isLoading` が `true` → ローディング表示
4. `useConvexAuth().isAuthenticated` が `false` → 接続エラー表示
5. すべて通過 → `KakeiboApp`（家計簿本体）

### useInitializeUser フック（`src/features/auth/hooks/useInitializeUser.ts`）

`KakeiboApp` のトップレベルで呼び出す。Convex 認証確立後に 1 回だけ `upsertUser` を呼び出し、
users テーブルにレコードを作成・更新します。

```typescript
function KakeiboApp() {
  useInitializeUser() // ← ここで呼び出す

  return ( ... )
}
```

- Convex 認証が確立された直後に 1 度だけ実行される（`useRef` で重複実行防止）
- エラーは `console.error` に記録し、UI をブロックしない

## 環境変数

`CLERK_JWT_ISSUER_DOMAIN` など Convex / Clerk 関連の環境変数の設定方法は
`docs/environment-variables.md` を参照してください。

## 関連ファイル

| ファイル                         | 役割                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| `convex/auth.config.ts`          | Convex の JWT issuer 設定（CLERK_JWT_ISSUER_DOMAIN を参照）        |
| `convex/schema.ts`               | users テーブル定義（`by_token_identifier` インデックス）           |
| `convex/users/auth.ts`           | 認証ヘルパー（`requireAuthenticatedUserId` 等）                    |
| `convex/users/mutations.ts`      | ユーザー向け mutation（`upsertUser` 等）                           |
| `src/main.tsx`                   | ClerkProvider + ConvexProviderWithClerk の Provider 構成           |
| `src/App.tsx`                    | 認証状態ガード（AuthenticatedApp）と KakeiboApp での初期化呼び出し |
| `src/features/auth/hooks/useInitializeUser.ts` | ログイン後の users upsert フック                                   |

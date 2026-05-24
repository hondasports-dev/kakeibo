# 環境変数一覧

このドキュメントは、kakeiboプロジェクトで使用する環境変数の一覧と設定方針を定義します。

## 概要

このプロジェクトは **DEV / Production の2環境**で運用する。Preview環境は設置しない。

- **Local**: 開発環境 (`.env.local`)
- **Production**: Vercel Production環境 (本番用)

## 環境変数一覧

### Clerk認証関連

| 変数名                       | 用途                           | Local | Production | Secret扱い | 設定場所                            |
| ---------------------------- | ------------------------------ | ----- | ---------- | ---------- | ----------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | フロントエンド用公開鍵         | ✅    | ✅         | ❌         | .env.local / Vercel Env             |
| `CLERK_SECRET_KEY`           | サーバー用秘密鍵               | ✅    | ✅         | ✅         | .env.local / Vercel Secrets         |
| `CLERK_JWT_ISSUER_DOMAIN`    | Convex認証用JWT issuerドメイン | ✅    | ✅         | ❌         | Convex Dashboard (CLI) / Vercel Env |
| `E2E_CLERK_USER_EMAIL`       | E2Eテスト用メール              | ✅    | ❌         | ✅         | .env.local のみ                     |
| `E2E_CLERK_USER_PASSWORD`    | E2Eテスト用パスワード          | ✅    | ❌         | ✅         | .env.local のみ                     |

### Convex関連

| 変数名                 | 用途                                     | Local | Production | Secret扱い | 設定場所                           |
| ---------------------- | ---------------------------------------- | ----- | ---------- | ---------- | ---------------------------------- |
| `CONVEX_DEPLOYMENT`    | ローカル開発用デプロイメント名           | ✅    | ❌         | ❌         | .env.local のみ                    |
| `VITE_CONVEX_URL`      | フロントエンド用Convex接続URL            | ✅    | ✅         | ❌         | .env.local / Vercel Env            |
| `VITE_CONVEX_SITE_URL` | Convex HTTP エンドポイントのベース URL   | ✅    | ❌         | ❌         | .env.local / GitHub Actions Secret |
| `CONVEX_DEPLOY_KEY`    | VercelビルドからConvexへのデプロイ用キー（現状未使用） | ❌    | ❌         | ✅         | 将来的に Vercel Secrets へ         |

### OpenAI / レシート画像抽出関連

| 変数名                          | 用途                                          | Local | Production | Secret扱い | 設定場所                    |
| ------------------------------- | --------------------------------------------- | ----- | ---------- | ---------- | --------------------------- |
| `OPENAI_API_KEY`                | OpenAI API 認証キー                           | ❌    | ✅         | ✅         | Convex Dashboard (CLI)      |
| `RECEIPT_IMAGE_EXTRACTOR_MODE`  | OpenAI 呼び出しの切り替え（`mock` / `real`）  | ✅    | ✅         | ❌         | Convex Dashboard (CLI)      |
| `APP_ENV`                       | real mode の許可判定（`development` / `preview` / `production`） | ✅ | ✅ | ❌ | Convex Dashboard (CLI) |

> `OPENAI_API_KEY` は Convex Action 内（サーバー側）でのみ使用する。フロントエンドには渡さない。
> ローカル・PR・Preview・CI では `RECEIPT_IMAGE_EXTRACTOR_MODE=mock` を使い、OpenAI API を呼ばない。
> `real` mode は `APP_ENV=production` のときのみ許可する。

### E2E テストクリーンアップ関連

| 変数名               | 用途                                      | Local | CI  | Secret扱い | 設定場所                                              |
| -------------------- | ----------------------------------------- | ----- | --- | ---------- | ----------------------------------------------------- |
| `E2E_CLEANUP_SECRET` | E2E クリーンアップ API の認証シークレット | ✅    | ✅  | ✅         | .env.local / GitHub Actions Secret / Convex Dashboard |
| `E2E_CLERK_USER_ID`  | テストユーザーの Clerk tokenIdentifier    | ✅    | ✅  | ✅         | .env.local / GitHub Actions Secret                    |

## 環境ごとの設定方針

### Local開発環境

`.env.local` に以下の環境変数を設定する。このファイルは `.gitignore` 済みで、リポジトリには含めない。

```env
# Clerk認証 (Development instance)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# E2Eテスト用 (Local専用)
E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
E2E_CLERK_USER_PASSWORD=change-me

# Convex
CONVEX_DEPLOYMENT=dev:your-deployment
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

`CLERK_JWT_ISSUER_DOMAIN` はフロントエンドでは使わないため `.env.local` には不要だが、
Convex バックエンド（dev deployment）には CLI で別途設定が必要：

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-frontend-api-url.clerk.accounts.dev
```

### Vercel Production環境

Vercel DashboardのEnvironment Variablesに設定する。

**Environment Variables (非秘匿)**:

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk Production instanceの公開鍵 (`pk_live_*`)
- `VITE_CONVEX_URL` — ProductionのConvex URL

**Secrets (秘匿)**:

- `CLERK_SECRET_KEY` — Clerk Production instanceの秘密鍵 (`sk_live_*`)
- `CONVEX_DEPLOY_KEY` — ConvexのProduction deploy key（**現状未設定・未使用**。将来的に `npx convex deploy` をビルドコマンドに組み込む場合に必要）

**Convex Dashboardに設定**:

- `CLERK_JWT_ISSUER_DOMAIN` — Convex側の認証設定 (`npx convex env set CLERK_JWT_ISSUER_DOMAIN <value>`)

### Clerk instanceの使い分け

| 環境       | Clerk instance       | キーの形式                |
| ---------- | -------------------- | ------------------------- |
| Local      | Development instance | `pk_test_*` / `sk_test_*` |
| Production | Production instance  | `pk_live_*` / `sk_live_*` |

> Production環境には必ずProduction instanceのキーを使うこと。
> Development instanceのキー (`pk_test_*`) を本番環境に設定しない。

## Vercel ビルドとConvexデプロイの仕組み

**現在の実態（2026-05 確認済み）**

Vercel のビルドコマンドは **`pnpm run build`（`tsc -b && vite build`）のみ**で、
`npx convex deploy` は実行されていない。そのため `CONVEX_DEPLOY_KEY` は
Vercel に設定されておらず、Vercel ビルドから Convex への関数デプロイは行われない。

Convex 関数のデプロイは、ローカル開発者が `npx convex dev --once` または
`npx convex dev` を手動で実行することで dev deployment に反映する。

**Vercel Preview 環境の Convex 接続先**

Vercel Preview は `VITE_CONVEX_URL` で dev deployment（`hardy-mockingbird-708.convex.cloud`）
を向いている。つまり、Preview も本番も同じ dev deployment を共有している状態。

この構成の含意:

- Convex 関数を追加・変更した PR では、E2E 実行前に `npx convex dev --once` で
  dev deployment に反映する必要がある。反映前に E2E を実行すると `FunctionNotFound`
  エラーが発生する。
- `VITE_CONVEX_SITE_URL`（Convex HTTP エンドポイント）は Production 環境のみに設定されており、
  Preview 環境には未設定。E2E cleanup は GitHub Actions Secrets から値を受け取るため問題なし。

**将来的な改善候補**（現時点では未実施）

Production に `npx convex deploy --cmd 'pnpm run build'` を導入する場合は:
- `CONVEX_DEPLOY_KEY` を Vercel Secrets に追加する
- Production Convex deployment に対して deploy key を発行する（Convex Dashboard）

## GitHub Actionsでの扱い

現状、GitHub ActionsからConvexへの直接デプロイは行わない。
Convex 関数のデプロイはローカルの `npx convex dev --once` で行う。

### GitHub Actions Secretsに保存する項目

- `VERCEL_AUTOMATION_BYPASS_SECRET` — Vercel Protection Bypass for Automation
- `CLERK_PUBLISHABLE_KEY` — Clerk Dev instance の公開鍵
- `CLERK_SECRET_KEY` — Clerk Dev instance の秘密鍵
- `E2E_CLERK_USER_EMAIL` — E2E テストユーザーのメールアドレス
- `E2E_CLERK_USER_PASSWORD` — E2E テストユーザーのパスワード
- `VITE_CONVEX_URL` — Dev deployment の Convex WebSocket URL
- `VITE_CONVEX_SITE_URL` — Dev deployment の Convex HTTP URL（例: `https://xxx.convex.site`）
- `E2E_CLEANUP_SECRET` — E2E クリーンアップ API 認証シークレット（Convex Dashboard の値と同一）
- `E2E_CLERK_USER_ID` — テストユーザーの Clerk tokenIdentifier（`https://xxx.clerk.accounts.dev|user_xxx`）

### 重要ルール

1. **Secrets限定**: 秘匿情報はGitHub Actions Secretsにのみ保存
2. **ログ出力禁止**: Secretsをログ、PRコメント、チャットに出力しない
3. **E2E用認証情報**: `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD` はGitHub Actions Secretsにのみ保存し、ログ・PRコメント・チャットには出力しない
4. **公開情報**: `VITE_*` はVercel DashboardのEnvironment Variablesに設定

## Convex Dashboard設定

Convex Dashboard (Deployment Settings > Environment Variables) に以下を設定：

- `CLERK_JWT_ISSUER_DOMAIN` — Clerk Frontend API URL (`https://xxxx.clerk.accounts.dev`)
- `E2E_CLEANUP_SECRET` — E2E クリーンアップ API 認証シークレット（未設定時はエンドポイントが 503 を返すため本番誤操作を防止できる）
- `RECEIPT_IMAGE_EXTRACTOR_MODE` — `mock`（ローカル・dev deployment）/ `real`（production deployment のみ）
- `APP_ENV` — `development`（ローカル・dev deployment）/ `production`（production deployment のみ）
- `OPENAI_API_KEY` — OpenAI API 認証キー（production deployment のみ設定。dev deployment には設定しない）

CLI での設定例:

```bash
# ローカル / dev deployment（mock mode）
pnpm exec convex env set RECEIPT_IMAGE_EXTRACTOR_MODE mock
pnpm exec convex env set APP_ENV development

# production deployment（real mode）
pnpm exec convex env set RECEIPT_IMAGE_EXTRACTOR_MODE real
pnpm exec convex env set APP_ENV production
pnpm exec convex env set OPENAI_API_KEY sk-...
```

> `CLERK_JWT_ISSUER_DOMAIN` はJWT issuerのドメインであり、公開情報に近い値のため
> Secretsではなく通常のEnvironment Variableとして扱う。真のSecretは `CLERK_SECRET_KEY` のみ。

## QA Agentとの連携方針

> ここでの「渡さない」とは、QA Agentのチャット・コンテキストへの共有を禁止する意味です。
> GitHub Actions Secretsへの保存はこの制限に含まれません。

### 渡さないSecret情報

- `CLERK_SECRET_KEY`
- `E2E_CLERK_USER_PASSWORD`
- `VERCEL_AUTOMATION_BYPASS_SECRET`（E2E導入後も渡さない）
- `CONVEX_DEPLOY_KEY`
- `OPENAI_API_KEY`

### 渡しても良い公開情報

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

### E2E実行方針

- Vercel Protection Bypassを使用 (`VERCEL_AUTOMATION_BYPASS_SECRET` はGitHub Actionsのみ)
- E2E実行フェーズでは、QA Agentはworkflow起動と結果確認のみ担当
- trace、HAR、スクリーンショットの保存期間は1〜3日に限定
- forkなど信頼できないPRではSecretを渡すE2Eを実行しない

## セキュリティ考慮事項

### 禁止事項

1. **Secretをコードに含めない**: `.env.local` はgitignore済み
2. **ログ出力禁止**: Secret情報をログ、コンソールに出力しない
3. **PRコメント禁止**: Secret情報をPRコメントやレビューに記載しない
4. **Artifact制限**: Secretを含む可能性のあるArtifactの保存期間を短くする

### 推奨事項

1. **定期ローテーション**: Secretは定期的に更新する
2. **最小権限**: 必要最小限の権限のみ付与する

## 運用設定

### Clerk Dashboard設定

- **Restricted mode**: 有効化 (公開範囲制限)
- **Invitation**: 招待制でユーザー登録を制限
- **Allowlist**: 使用しない (envで管理しない)

### 注意事項

- Restricted modeとinvitationはClerk Dashboardの運用設定として扱う
- invitation対象メールは `.env.local`、Vercel env、アプリコードに持たせない
- Allowlist用envは作らない方針とする

## 運用ルール

- 環境変数を追加・削除する際は `.env.example` も必ず更新する
- `.env.example` はすべての変数を含む（値はプレースホルダー）
- `VITE_*` でない変数をフロントエンドで参照しない

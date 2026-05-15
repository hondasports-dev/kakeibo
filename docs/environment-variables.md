# 環境変数一覧

このドキュメントは、kakeiboプロジェクトで使用する環境変数の一覧と設定方針を定義します。

## 概要

このプロジェクトは **DEV / Production の2環境**で運用する。Preview環境は設置しない。

- **Local**: 開発環境 (`.env.local`)
- **Production**: Vercel Production環境 (本番用)

## 環境変数一覧

### Clerk認証関連

| 変数名 | 用途 | Local | Production | Secret扱い | 設定場所 |
|--------|------|-------|------------|------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | フロントエンド用公開鍵 | ✅ | ✅ | ❌ | .env.local / Vercel Env |
| `CLERK_SECRET_KEY` | サーバー用秘密鍵 | ✅ | ✅ | ✅ | .env.local / Vercel Secrets |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex認証用JWT issuerドメイン | ✅ | ✅ | ❌ | Convex Dashboard (CLI) / Vercel Env |
| `E2E_CLERK_USER_EMAIL` | E2Eテスト用メール | ✅ | ❌ | ✅ | .env.local のみ |
| `E2E_CLERK_USER_PASSWORD` | E2Eテスト用パスワード | ✅ | ❌ | ✅ | .env.local のみ |

### Convex関連

| 変数名 | 用途 | Local | Production | Secret扱い | 設定場所 |
|--------|------|-------|------------|------------|----------|
| `CONVEX_DEPLOYMENT` | ローカル開発用デプロイメント名 | ✅ | ❌ | ❌ | .env.local のみ |
| `VITE_CONVEX_URL` | フロントエンド用Convex接続URL | ✅ | ✅ | ❌ | .env.local / Vercel Env |
| `CONVEX_DEPLOY_KEY` | VercelビルドからConvexへのデプロイ用キー | ❌ | ✅ | ✅ | Vercel Secrets のみ |

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
- `CONVEX_DEPLOY_KEY` — ConvexのProduction deploy key (Convex Dashboard > Deployment Settings > Generate Production Deploy Key)

**Convex Dashboardに設定**:
- `CLERK_JWT_ISSUER_DOMAIN` — Convex側の認証設定 (`npx convex env set CLERK_JWT_ISSUER_DOMAIN <value>`)

### Clerk instanceの使い分け

| 環境 | Clerk instance | キーの形式 |
|------|---------------|-----------|
| Local | Development instance | `pk_test_*` / `sk_test_*` |
| Production | Production instance | `pk_live_*` / `sk_live_*` |

> Production環境には必ずProduction instanceのキーを使うこと。
> Development instanceのキー (`pk_test_*`) を本番環境に設定しない。

## Vercel ビルドとConvexデプロイの仕組み

Vercel と GitHub を連携している場合、Convexのデプロイは **Vercelのビルドコマンド経由**で行われる。
**Convex のデプロイに関しては** GitHub Actions は使用しない（Vercelビルド経由のため）。
lint/build の CI チェックや将来の E2E 実行には GitHub Actions を使用する。

**Vercel Build Commandの設定:**
```
npx convex deploy --cmd 'pnpm run build'
```

`npx convex deploy` が `CONVEX_DEPLOY_KEY` を読み込み、ConvexのProductionデプロイメントに
関数をpushした上でフロントエンドをビルドする。`CONVEX_DEPLOY_KEY` はVercelのSecretsに
設定するだけでよく、GitHub Actions Secretsには不要。

## GitHub Actionsでの扱い

現状、GitHub ActionsからConvexへの直接デプロイは行わない（Vercelビルド経由のため）。

### GitHub Actions Secretsに保存する項目

- `VERCEL_AUTOMATION_BYPASS_SECRET` — E2E Playwright導入時に追加予定
- `E2E_CLERK_USER_EMAIL` — E2E Playwright導入時に追加予定
- `E2E_CLERK_USER_PASSWORD` — E2E Playwright導入時に追加予定（信頼できるブランチのみ）

### 重要ルール

1. **Secrets限定**: 秘匿情報はGitHub Actions Secretsにのみ保存
2. **ログ出力禁止**: Secretsをログ、PRコメント、チャットに出力しない
3. **E2E用認証情報**: `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD` はGitHub Actions Secretsにのみ保存し、ログ・PRコメント・チャットには出力しない
4. **公開情報**: `VITE_*` はVercel DashboardのEnvironment Variablesに設定

## Convex Dashboard設定

Convex Dashboard (Deployment Settings > Environment Variables) に以下を設定：

- `CLERK_JWT_ISSUER_DOMAIN` — Clerk Frontend API URL (`https://xxxx.clerk.accounts.dev`)

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

### 渡しても良い公開情報

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

### E2E実行方針

- Vercel Protection Bypassを使用 (`VERCEL_AUTOMATION_BYPASS_SECRET` はGitHub Actionsのみ)
- QA Agentはworkflow起動と結果確認のみ担当
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

## 更新履歴

- 2026-05-15: 初版作成 (Issue #5対応)
- 2026-05-15: Tech Leadレビュー指摘を反映。Preview環境廃止、CONVEX_DEPLOY_KEY追加、VITE_CONVEX_SITE_URL削除（Convex HTTP Actions未使用のため不要と判断）、CLERK_JWT_ISSUERのSecret扱い見直し、VERCEL_AUTOMATION_BYPASS_SECRETの扱い整合化、.env.example整合性ルール追加
- 2026-05-15: Reviewerレビュー指摘を反映。E2E用認証情報のGitHub Actions格納方針を修正、QA Agentへの「渡さない」スコープを明確化、CONVEX_DEPLOYMENTのSecret扱いを修正、CLERK_JWT_ISSUER_DOMAINのLocal設定方法（Convex CLI）を明確化、Convexデプロイに限定したGitHub Actions不使用表現に修正

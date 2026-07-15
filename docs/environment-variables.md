# 環境変数一覧

このドキュメントは、kakeiboプロジェクトで使用する環境変数の一覧と設定方針を定義します。

## 概要

このプロジェクトは **DEV / PREVIEW / PROD** を分けて運用する。

- **Local**: 開発環境 (`.env.local`)
- **DEV**: 通常開発、PR単位のCI内Vite E2E、PR単位のVercel Preview
- **PREVIEW**: `preview` branch の統合確認とPROD候補確認
- **PROD**: Vercel Production環境 (本番用)

PROD 反映は `.github/workflows/production-release.yml` を正規ルートとし、GitHub Environment `production` の承認後にだけ実行する。

## 環境変数一覧

### Clerk認証関連

| 変数名                       | 用途                           | Local | DEV/PR Preview | PREVIEW RC | PROD | Secret扱い | 設定場所                            |
| ---------------------------- | ------------------------------ | ----- | -------------- | ---------- | ---- | ---------- | ----------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | フロントエンド用公開鍵         | ✅    | ✅             | ✅         | ✅   | ❌         | .env.local / Vercel Env             |
| `CLERK_SECRET_KEY`           | サーバー用秘密鍵。Convex Action から Clerk Backend API を呼ぶためにも使う | ✅ | ✅ | ✅ | ✅ | ✅ | .env.local / GitHub Actions Secret / Convex Dashboard |
| `CLERK_JWT_ISSUER_DOMAIN`    | Convex認証用JWT issuerドメイン | ✅    | ✅             | ✅         | ✅   | ❌         | Convex Dashboard / Vercel Env       |
| `E2E_CLERK_USER_EMAIL`       | E2Eテスト用メール              | ✅    | ✅             | 任意       | ❌   | ✅         | .env.local / GitHub Actions Secret  |
| `E2E_CLERK_USER_PASSWORD`    | E2Eテスト用パスワード（レガシー） | 任意  | 任意           | 任意       | ❌   | ✅         | `.env.example` に残存。**現行 E2E auth helper（`e2e/helpers/auth.ts`）では未使用** |

### Convex関連

| 変数名                 | 用途                                     | Local | DEV/PR Preview | PREVIEW RC | PROD | Secret扱い | 設定場所                           |
| ---------------------- | ---------------------------------------- | ----- | -------------- | ---------- | ---- | ---------- | ---------------------------------- |
| `CONVEX_DEPLOYMENT`    | ローカル開発用デプロイメント名           | ✅    | ❌             | ❌         | ❌   | ❌         | .env.local のみ                    |
| `VITE_CONVEX_URL`      | フロントエンド用Convex接続URL            | ✅    | ✅             | 自動設定   | ✅   | ❌         | .env.local / Vercel Env / Convex deploy |
| `VITE_CONVEX_SITE_URL` | Convex HTTP エンドポイントのベース URL   | ✅    | ✅             | ✅         | ✅   | ❌         | .env.local / GitHub Actions Secret / GitHub Actions Variable / Vercel Env |
| `CONVEX_DEPLOY_KEY`    | Convex deploy key                        | ❌    | ❌             | ✅         | ✅   | ✅         | GitHub Actions Secret / Vercel Env |

### OpenAI / レシート画像抽出関連

| 変数名                         | 用途                                         | Local | DEV/PR Preview | PREVIEW RC | PROD | Secret扱い | 設定場所               |
| ------------------------------ | -------------------------------------------- | ----- | -------------- | ---------- | ---- | ---------- | ---------------------- |
| `OPENAI_API_KEY`               | OpenAI API 認証キー                          | ❌    | ❌             | ❌         | ✅   | ✅         | Convex Dashboard       |
| `RECEIPT_IMAGE_EXTRACTOR_MODE` | OpenAI 呼び出しの切り替え（`mock` / `real`） | ✅    | ✅             | ✅         | ✅   | ❌         | Convex Dashboard       |
| `APP_ENV`                      | real mode の許可判定（`development` / `preview` / `production`） | ✅ | ✅ | ✅ | ✅ | ❌ | Convex Dashboard |

### トランザクションメール (Resend) 関連

| 変数名                       | 用途                                       | Local | DEV/PR Preview | PREVIEW RC | PROD | Secret扱い | 設定場所            |
| ---------------------------- | ------------------------------------------ | ----- | -------------- | ---------- | ---- | ---------- | ------------------- |
| `APP_BASE_URL`               | メール CTA 用の絶対 URL のベース。未設定時は `http://localhost:5173` をフォールバック | 任意  | ✅             | ✅         | ✅   | ❌         | Convex Dashboard    |
| `RESEND_API_KEY`             | Resend API 認証キー                        | ✅    | ✅             | ✅         | ✅   | ✅         | Convex Dashboard    |
| `RESEND_FROM_ADDRESS`        | 送信元 From アドレス（`Name <email@domain>`） | ✅ | ✅ | ✅ | ✅ | ❌ | Convex Dashboard |
| `RESEND_WEBHOOK_SECRET`      | Resend webhook 署名検証用シークレット      | ✅    | ✅             | ✅         | ✅   | ✅         | Convex Dashboard    |

> `RESEND_API_KEY` と `RESEND_WEBHOOK_SECRET` は Convex Action 内（サーバー側）でのみ使用する。フロントエンドには渡さない。
> `APP_ENV` が `production` 以外の場合、`RESEND_API_KEY` を使っても実メールは送信されず、モック応答（`providerMessageId` に `mock-` 接頭辞）が返る。Local / DEV / PREVIEW / CI では実メールを送らない。
> `RESEND_FROM_ADDRESS` に設定するドメインは Resend Dashboard で verified domain にする必要がある。

> `OPENAI_API_KEY` は Convex Action 内（サーバー側）でのみ使用する。フロントエンドには渡さない。
> ローカル・PR・Preview・CI では `RECEIPT_IMAGE_EXTRACTOR_MODE=mock` を使い、OpenAI API を呼ばない。
> `real` mode は `APP_ENV=production` のときのみ許可する。

### E2E テストクリーンアップ関連

| 変数名               | 用途                                      | Local | CI  | Secret扱い | 設定場所                                              |
| -------------------- | ----------------------------------------- | ----- | --- | ---------- | ----------------------------------------------------- |
| `E2E_CLEANUP_SECRET` | E2E クリーンアップ API の認証シークレット | ✅    | ✅  | ✅         | .env.local / GitHub Actions Secret / Convex Dashboard |
| `E2E_CLERK_USER_ID`  | テストユーザーの Clerk tokenIdentifier    | ✅    | ✅  | ✅         | .env.local / GitHub Actions Secret                    |

`E2E_CLEANUP_SECRET` を Convex deployment に設定すると、`convex/http.ts`（実装は `convex/e2eHttp/`）の E2E 専用 HTTP エンドポイントが有効化される。いずれもヘッダ `X-E2E-Cleanup-Secret` が必要。

| エンドポイント | 用途 |
| --- | --- |
| `POST /e2e/cleanup` | E2E テストデータのクリーンアップ |
| `POST /e2e/seed-ai-expense-draft` | AI 下書きのシード（認証なし疎通確認） |
| `POST /e2e/seed-pending-group-invitation` | pending 招待のシード（`group-access` E2E 用） |

## 環境ごとの設定方針

### Local開発環境

`.env.local` に以下の環境変数を設定する。このファイルは `.gitignore` 済みで、リポジトリには含めない。

```env
# Clerk認証 (Development instance)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# E2Eテスト用 (Local専用)
E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
# E2E_CLERK_USER_PASSWORD は .env.example に残存するが、現行 auth helper では未使用

# Convex
CONVEX_DEPLOYMENT=dev:your-deployment
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

E2E 認証は `@clerk/testing` の Testing Token + `email_code` 方式（`e2e/helpers/auth.ts`）。
`CLERK_SECRET_KEY` と `E2E_CLERK_USER_EMAIL` が必須。Playwright は `CLERK_PUBLISHABLE_KEY`
（`VITE_` なし）も参照する（`playwright.config.ts` が `VITE_CLERK_PUBLISHABLE_KEY` から設定）。

`CLERK_JWT_ISSUER_DOMAIN` と `CLERK_SECRET_KEY` は Convex バックエンド（dev deployment）にも CLI で別途設定が必要。
特にグループ招待メール送信は Convex Action から Clerk Backend API を呼ぶため、
`CLERK_SECRET_KEY` が Convex 側に未設定だと `groupInvitations:inviteMember` が失敗する。

```bash
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-frontend-api-url.clerk.accounts.dev
pnpm exec convex env set CLERK_SECRET_KEY sk_test_...
```

### Vercel Preview / PREVIEW環境

PR単位の Preview は通常の開発確認に使う。`preview` branch は統合確認用の固定 PREVIEW とし、
`preview-deploy.yml` が固定 Convex staging deployment と Vercel Preview を更新する。

Vercel Preview Environment には次を設定する。

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk Development instance の公開鍵 (`pk_test_*`)

固定 Convex staging deployment は GitHub Environment `Preview` の `CONVEX_DEPLOY_KEY` で更新する。
`VITE_CONVEX_URL` は `convex deploy --cmd-url-env-var-name VITE_CONVEX_URL` により、
Vercel build 時に staging deployment の URL が渡される。

GitHub Environment `Preview` には次を設定する。

| 種類     | 名前                | 用途                                  |
| -------- | ------------------- | ------------------------------------- |
| Secret   | `VERCEL_TOKEN`      | Vercel CLI を GitHub Actions から実行する |
| Secret   | `CONVEX_DEPLOY_KEY` | 固定 Convex staging deployment を更新する |
| Variable | `VERCEL_ORG_ID`     | Vercel project の所属ID               |
| Variable | `VERCEL_PROJECT_ID` | Vercel project ID                     |

`CONVEX_DEPLOY_KEY` には、固定 staging deployment 用の deploy key を保存する。
`preview-deploy.yml` はこの key で staging functions / schema を反映する。

Convex staging deployment には次を設定する。

- `CLERK_JWT_ISSUER_DOMAIN`
- `CLERK_SECRET_KEY`
- `RECEIPT_IMAGE_EXTRACTOR_MODE=mock`
- `APP_ENV=preview`

PREVIEW では Clerk Development instance を使う。Production instance や `pk_live_*` / `sk_live_*` は使わない。

### Vercel Production環境

PROD 環境には Production 用の値だけを設定する。DEV / PREVIEW の Clerk Development instance、Convex dev / staging deployment、`pk_test_*` / `sk_test_*` を流用しない。

Vercel DashboardのEnvironment Variablesに設定する。

**Environment Variables (非秘匿)**:

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk Production instanceの公開鍵 (`pk_live_*`)
- `VITE_CONVEX_URL` — ProductionのConvex URL

**Secrets (秘匿)**:

- `CLERK_SECRET_KEY` — Clerk Production instanceの秘密鍵 (`sk_live_*`)

**Convex Dashboardに設定**:

- `CLERK_JWT_ISSUER_DOMAIN` — Convex側の認証設定 (`npx convex env set CLERK_JWT_ISSUER_DOMAIN <value>`)
- `CLERK_SECRET_KEY` — Convex Action から Clerk Backend API を呼ぶための秘密鍵 (`pnpm exec convex env set CLERK_SECRET_KEY <value>`)

**GitHub Environment `production` に設定**:

- `CONVEX_DEPLOY_KEY` — ConvexのProduction deploy key。Vercel Production Environment へは通常保存しない。

### Clerk instanceの使い分け

| 環境       | Clerk instance       | キーの形式                |
| ---------- | -------------------- | ------------------------- |
| Local      | Development instance | `pk_test_*` / `sk_test_*` |
| DEV/Preview | Development instance | `pk_test_*` / `sk_test_*` |
| PREVIEW RC | Development instance | `pk_test_*` / `sk_test_*` |
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

**Vercel Preview / PREVIEW 環境の Convex 接続先**

通常の PR Preview は、既存の Vercel Git Integration と E2E 方針に従い dev deployment を向く。
`preview` branch の統合確認は、固定 Convex staging deployment を向く。
`preview-deploy.yml` は `convex deploy --cmd-url-env-var-name VITE_CONVEX_URL` で staging URL を Vercel build に渡す。

この構成の含意:

- Convex 関数を追加・変更した PR では、E2E 実行前に `npx convex dev --once` で
  dev deployment に反映する必要がある。反映前に E2E を実行すると `FunctionNotFound`
  エラーが発生する。
- PREVIEW は dev deployment ではなく固定 Convex staging deployment を使うため、DEVデータは共有しない。
- `VITE_CONVEX_SITE_URL`（Convex HTTP エンドポイント）は Local / DEV E2E で使う。
  PREVIEW では必要な smoke 内容に応じて、Convex staging deployment の site URL を使うか、
  cleanup不要の非破壊確認に絞る。

PREVIEW には `pnpm exec convex deploy --cmd-url-env-var-name VITE_CONVEX_URL` を使う。

Production には `production-release.yml` から `pnpm exec convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'pnpm exec vercel build --yes --prod --token "$VERCEL_TOKEN"'` を使う。これにより、Convex Production functions を先に反映し、その Production URL を Vercel Production build に渡す。

## GitHub Actionsでの扱い

PR単位のE2Eでは、GitHub ActionsからConvexへの直接デプロイは行わない。
Convex 関数のデプロイはローカルの `npx convex dev --once` で行う。

### Production リリース時の生成変数

`production-release.yml` は承認後に次の変数を生成し、Vercel Production ビルドに渡す。

| 変数名 | 値例 | 用途 | 生成箇所 |
| --- | --- | --- | --- |
| `APP_VERSION` | `2026.07.11-458` | ユーザー向けアプリバージョン | `TZ=Asia/Tokyo date +%Y.%m.%d-${GITHUB_RUN_NUMBER}` |
| `PUBLISHED_AT` | `2026-07-11` | Product Update の `publishedAt` | `TZ=Asia/Tokyo date +%Y-%m-%d` |
| `VITE_APP_VERSION` | `2026.07.11-458` | Vite ビルドで `<meta name="app-version">` と React ページに注入 | `APP_VERSION` と同値 |
| `OPENAI_API_KEY` | `sk-...` | PR 判定による Product Update 生成（オプション） | GitHub Actions secret `PRODUCT_UPDATE_OPENAI_API_KEY` |
| `RELEASE_NOTE` | `m15 PREVIEW URL確認済み` | GitHub Release のリリースノート本文 | `workflow_dispatch.inputs.release_note` または `main` push 時の定型文 |
| `BASE_REF` | `main` | マージ済み PR を検索する base branch | `main` または `inputs.source_ref` |

これらは GitHub Actions 上で生成される。Vercel Dashboard には `VITE_APP_VERSION` を固定値として設定しない。

`preview` branch への push では、`preview-deploy.yml` が固定 Convex staging deployment を更新し、Vercel Preview へデプロイする。smoke E2E はそのURLではなくCI内Viteを対象にする。

PROD 反映では、`main` への push で `production-release.yml` が自動起動する。preflight の後にGitHub Environment `Preview` の固定stagingとVercel release candidateでsmoke E2Eを実行し、成功後にGitHub Environment `production` の承認を待つ。承認後に Convex Production、Vercel Production、PROD smoke checklist の順で実行する。手動リリースや forward-fix では、同じ workflow を `workflow_dispatch` で実行してよい。

### GitHub Actions Secretsに保存する項目

- `VERCEL_AUTOMATION_BYPASS_SECRET` — main／手動Production release candidate E2E用のVercel Protection Bypass for Automation
- `CLERK_PUBLISHABLE_KEY` — Clerk Dev instance の公開鍵
- `CLERK_SECRET_KEY` — Clerk Dev instance の秘密鍵
- `E2E_CLERK_USER_EMAIL` — E2E テストユーザーのメールアドレス
- `E2E_CLERK_USER_PASSWORD` — レガシー。現行 E2E は Testing Token 方式のため未使用
- `VITE_CONVEX_URL` — PR CI内Viteが接続するDev deploymentのConvex WebSocket URL
- `DEV_VITE_CONVEX_SITE_URL` — PR Preview が接続する Dev deployment の Convex HTTP URL
- `DEV_E2E_CLEANUP_SECRET` — Dev deployment の E2E クリーンアップ API 認証シークレット
- `DEV_CONVEX_DEPLOY_KEY` — Dev deployment の deploy key（PR E2E 前に `E2E_CLEANUP_SECRET` を Convex へ同期）
- `E2E_CLEANUP_SECRET` — 固定 staging deployment の E2E クリーンアップ API 認証シークレット
- `E2E_CLERK_USER_ID` — テストユーザーの Clerk tokenIdentifier（`https://xxx.clerk.accounts.dev|user_xxx`）
- `PRODUCT_UPDATE_OPENAI_API_KEY` — 任意。Product Update 生成用の OpenAI API key

### GitHub Environment `Preview` に保存する項目

- `VERCEL_TOKEN` — Vercel CLI 実行用 token
- `CONVEX_DEPLOY_KEY` — Convex Preview Deploy Key
- `VERCEL_ORG_ID` — GitHub Actions Variable として保存
- `VERCEL_PROJECT_ID` — GitHub Actions Variable として保存
- `VITE_CONVEX_SITE_URL` — 固定 staging deployment の HTTP URL を GitHub Actions Variable として保存

### GitHub Environment `production` に保存する項目

- `VERCEL_TOKEN` — Vercel CLI 実行用 token
- `CONVEX_DEPLOY_KEY` — Convex Production Deploy Key
- `PRODUCT_UPDATE_OPENAI_API_KEY` — 任意。Product Update 生成用の OpenAI API key
- `VERCEL_ORG_ID` — GitHub Actions Variable として保存
- `VERCEL_PROJECT_ID` — GitHub Actions Variable として保存
- `PRODUCTION_SMOKE_URL` — 任意。custom domain など smoke 対象を固定したい場合に Variable として保存

Production 用の secret / variable は `production` environment にだけ置く。`Preview` environment、Repository secret、ローカル `.env.local` へコピーしない。

### 重要ルール

1. **Secrets限定**: 秘匿情報はGitHub Actions Secretsにのみ保存
2. **ログ出力禁止**: Secretsをログ、PRコメント、チャットに出力しない
3. **E2E用認証情報**: `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD` はGitHub Actions Secretsにのみ保存し、ログ・PRコメント・チャットには出力しない
4. **公開情報**: `VITE_*` はVercel DashboardのEnvironment Variablesに設定

## Convex Dashboard設定

Convex Dashboard (Deployment Settings > Environment Variables) に以下を設定：

- `CLERK_JWT_ISSUER_DOMAIN` — Clerk Frontend API URL (`https://xxxx.clerk.accounts.dev`)
- `CLERK_SECRET_KEY` — Clerk Backend API 用の秘密鍵。グループ招待メール送信で必要
- `E2E_CLEANUP_SECRET` — E2E クリーンアップ API 認証シークレット（未設定時はエンドポイントが 503 を返すため本番誤操作を防止できる）
- `RECEIPT_IMAGE_EXTRACTOR_MODE` — `mock`（Local / DEV / PREVIEW）/ `real`（PRODのみ）
- `APP_ENV` — `development`（Local / DEV）/ `preview`（PREVIEW）/ `production`（PROD）
- `OPENAI_API_KEY` — OpenAI API 認証キー（production deployment のみ設定。dev deployment には設定しない）

Convex staging deployment では、`APP_ENV=preview`、
`RECEIPT_IMAGE_EXTRACTOR_MODE=mock` を使う。PREVIEW には `OPENAI_API_KEY` を設定しない。

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
- `PRODUCT_UPDATE_OPENAI_API_KEY`

### 渡しても良い公開情報

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

### E2E実行方針

- PR／`preview` のE2Eは `E2E_BASE_URL` を設定せず、GitHub Actions内のVite dev serverを使う
- Vercel Protection Bypassはmain／手動Production release candidate E2Eだけで使用する
  (`VERCEL_AUTOMATION_BYPASS_SECRET` はGitHub Actionsのみ)
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

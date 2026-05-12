# Service Tooling Setup

## 1. 目的

本ドキュメントは、`kakeibo` の初期セットアップで使う外部サービス操作ツールの設定方法をまとめる。

対象は以下とする。

- Clerk CLI
- Vercel MCP
- Convex MCP
- Clerk MCP（補助）

MCP serverの設定方法は、Codex CLIでの設定を前提にする。

Clerk CLIはMCPではないため、旧ファイル名 `MCP_SETUP.md` では内容と名前がずれる。そのため、外部サービス操作用ツール全体を扱う `SERVICE_TOOLING_SETUP.md` として管理する。

## 2. 採用方針

| ツール | 採用 | 主な用途 | 状態 |
|---|---:|---|---|
| Clerk CLI | 採用 | Clerk初期化、app連携、env取得、設定差分管理、API確認 | documented / not configured |
| Vercel MCP | 採用 | Vercel docs検索、project/deployment/log確認 | documented / not configured |
| Convex MCP | 採用 | Convex deployment、tables、logs、env確認 | documented / not configured |
| Clerk MCP | 補助採用 | Clerk SDK snippets、実装パターン確認 | documented / optional |

初期セットアップでは、Clerk CLI、Vercel MCP、Convex MCPを優先する。Clerk MCPは、認証実装の調査やコード例確認に限定する。

## 3. 環境マッピング

無料枠前提では、以下の対応にする。

| 用途 | Vercel | Clerk | Convex |
|---|---|---|---|
| local dev | local `.env.local` | Development instance `pk_test_*` | dev deployment |
| preview PR | Vercel Preview `*.vercel.app` URL | 原則Development instance | dev deployment、必要時preview deployment |
| production | Vercel Production `*.vercel.app` URL | Production instance `pk_live_*` | production deployment |

注意:

- 独自ドメインは初期MVPでは使わない
- Clerk Development instanceは本番用途に使わない
- Vercel Custom EnvironmentはMVPでは使わない
- Convex production deploymentは通常MCPから触らない

## 4. Clerk CLIセットアップ

### 4.1 役割

Clerk CLIは、Clerkの初期導入、アプリ連携、環境変数取得、設定差分管理、Backend/Platform API確認に使う。

`kakeibo`では、Google OAuthの本番設定やSecret rotationまではCLIに任せず、DashboardとGoogle Cloud Consoleを併用する。

### 4.2 インストール

いずれかを使う。

```bash
npm install -g clerk
```

```bash
pnpm install -g clerk
```

```bash
brew install clerk/stable/clerk
```

または、グローバルインストールせずに以下で実行する。

```bash
npx clerk --help
```

### 4.3 認証

```bash
clerk auth login
```

現在のログイン状態とリンク先を確認する。

```bash
clerk whoami
```

### 4.4 Clerk app作成とリンク

既存appを確認する。

```bash
clerk apps list
```

必要ならappを作成する。

```bash
clerk apps create
```

ローカルプロジェクトとClerk appを紐付ける。

```bash
clerk link --app app_xxx
```

紐付け解除が必要な場合のみ使う。

```bash
clerk unlink
```

### 4.5 初期導入

Clerk SDKの導入やフレームワーク別セットアップには以下を使う。

```bash
clerk init
```

AIエージェント向けに手順だけ確認したい場合は、プロジェクトを変更しない方法を優先する。

```bash
clerk init --prompt
```

注意:

- `clerk init` はプロジェクトファイルを変更する可能性がある
- 実行前に作業ツリーの差分を確認する
- React RouterやVite構成では、生成内容を既存設計に合わせてレビューする

### 4.6 env取得

Development instanceの環境変数を取得する。

```bash
clerk env pull
```

Production instanceの環境変数を取得する必要がある場合だけ使う。

```bash
clerk env pull --instance prod
```

注意:

- `clerk env pull --instance prod` は本番secretをローカルに落とす可能性がある
- 必要時だけ実行する
- `.env.local` はGitに入れない
- `CLERK_SECRET_KEY` を `VITE_` prefix付きにしない

Vite frontendで使う値:

```text
VITE_CLERK_PUBLISHABLE_KEY=
```

React SPAから直接使わない値:

```text
CLERK_SECRET_KEY=
```

### 4.7 config管理

現在の設定スキーマを確認する。

```bash
clerk config schema
```

現在設定をスナップショットとして保存する。

```bash
clerk config pull --output clerk.config.before.json
```

変更前にdry-runで差分を確認する。

```bash
clerk config patch --dry-run --json '{"session":{"lifetime":604800}}'
```

差分確認後に適用する。

```bash
clerk config patch --json '{"session":{"lifetime":604800}}' --yes
```

注意:

- `clerk config patch --dry-run` を先に使う
- `clerk config put` は全置換のため、基本的には使わない
- Production instanceへの設定変更は事前確認を必須にする

### 4.8 API確認

Backend APIの確認に使う。

```bash
clerk api /users
```

Platform APIの確認に使う。

```bash
clerk api --platform /platform/applications
```

注意:

- API出力には個人情報やsecretが含まれる可能性がある
- 出力をチャットやログへ貼らない
- user managementやanalyticsなどの高度な操作はDashboard中心にする

### 4.9 診断とDashboard

Clerk連携の診断に使う。

```bash
clerk doctor
```

Dashboardを開く。

```bash
clerk open
```

### 4.10 Clerk CLIだけに任せない操作

以下はDashboard、Google Cloud Console、またはClerk API併用を前提にする。

- Google OAuthのProduction credentials設定
- Google Cloud ConsoleでのOAuth client作成
- Google Cloud ConsoleでのAuthorized Redirect URI登録
- Clerk Production domainの有効化
- Secret Key rotation
- Webhook endpoint作成
- Webhook signing secret rotation
- Analyticsや高度なユーザー管理

## 5. Vercel MCPセットアップ

### 5.1 役割

Vercel MCPは、Vercel project、deployment、build logs、runtime logsの確認に使う。

環境変数や本番deployなどの変更系操作は、MCPだけに寄せず、Vercel DashboardまたはVercel CLI/APIを併用する。

### 5.2 Codex CLI設定

Codexでは、Vercel MCPをstreamable HTTP serverとして追加する。

```bash
codex mcp add vercel --url https://mcp.vercel.com
```

Vercel MCPはOAuthで接続する。ブラウザが開いた場合は、接続先が公式URLであることを確認してから認可する。

設定後に確認する。

```bash
codex mcp get vercel
```

認証状態に問題がある場合は、CodexのMCP loginを使う。

```bash
codex mcp login vercel
```

### 5.3 project-specific URL

Vercel project作成後は、project-specific URLを使うと、team/projectの指定ミスを減らせる。

```text
https://mcp.vercel.com/<teamSlug>/<projectSlug>
```

`kakeibo` project作成後にこの形式へ切り替えるか検討する。

Codexでproject-specific URLに切り替える場合は、一度既存設定を削除してから追加し直す。

```bash
codex mcp remove vercel
codex mcp add vercel --url https://mcp.vercel.com/<teamSlug>/<projectSlug>
```

### 5.4 Vercel MCPで使う操作

- project一覧、詳細確認
- deployment一覧、詳細確認
- build logs確認
- runtime logs確認
- protected deploymentの一時共有URL取得
- deployment状況確認

### 5.5 Vercel MCPだけに任せない操作

以下は人間確認を必須にする。

- production deploy
- Vercel環境変数の登録、変更、削除
- domain追加、購入、移管
- protected deployment URL共有
- billingやplanに影響する操作

## 6. Convex MCPセットアップ

### 6.1 役割

Convex MCPは、Convex deployment、tables、data、function spec、logs、insights、envを確認するために使う。

`kakeibo`では、dev deployment中心に使う。

### 6.2 Codex CLI設定

Codexでは、Convex MCPをstdio serverとして追加する。

```bash
codex mcp add convex -- npx -y convex@latest mcp start --project-dir /Users/miyamototatsuya/Documents/sourcecode/sandbox/kakeibo
```

設定後に確認する。

```bash
codex mcp get convex
```

### 6.3 Codex configで確認する場合

Codex CLIで追加した設定は、通常 `~/.codex/config.toml` 側に保存される。手動編集するより、`codex mcp add` / `codex mcp remove` を優先する。

設定内容をTOMLで確認する場合は、概ね以下の形になる。

```toml
[mcp_servers.convex]
command = "npx"
args = ["-y", "convex@latest", "mcp", "start", "--project-dir", "/Users/miyamototatsuya/Documents/sourcecode/sandbox/kakeibo"]
```

### 6.4 Convex MCPで使う操作

- deployment status確認
- tables確認
- data閲覧
- read-only one-off query実行
- function spec確認
- deployed function実行
- logs確認
- insights確認
- environment variableの一覧、取得、設定、削除

### 6.5 production deploymentの扱い

Convex MCPは、デフォルトではproduction deploymentへアクセスできない。これは本番データの誤操作を避けるための安全設計である。

本番確認が必要な場合だけ、明示的に別名で追加する。

```bash
codex mcp add convex-prod-readonly -- npx -y convex@latest mcp start \
  --project-dir /Users/miyamototatsuya/Documents/sourcecode/sandbox/kakeibo \
  --dangerously-enable-production-deployments \
  --disable-tools envSet,envRemove,run
```

本番MCP利用時の原則:

- read-only確認を基本にする
- `envSet`、`envRemove`、`run` は無効化する
- `envGet` の出力はsecret扱いにする
- 秘密値をチャットやログに出さない
- 本番データを変更する操作は事前確認を必須にする
- 作業後はproduction用MCP設定を削除する

```bash
codex mcp remove convex-prod-readonly
```

## 7. Clerk MCP

### 7.1 役割

Clerk MCPは、Clerk SDK snippetsや認証実装パターンの確認に使う。

Clerk app作成、Google OAuth設定、Production activation、API key確認などの実操作は、Clerk CLI、Dashboard、Clerk APIを併用する。

### 7.2 Codex CLI設定例

Codexでは、Clerk MCPをstreamable HTTP serverとして追加する。

```bash
codex mcp add clerk --url https://mcp.clerk.com/mcp
```

設定後に確認する。

```bash
codex mcp get clerk
```

認証状態に問題がある場合は、CodexのMCP loginを使う。

```bash
codex mcp login clerk
```

### 7.3 Codex configで確認する場合

```toml
[mcp_servers.clerk]
type = "url"
url = "https://mcp.clerk.com/mcp"
```

## 8. 人間確認が必要な操作

以下は、AIエージェントやMCPで実行する前に明示確認を必須にする。

- production deploy
- production env変更
- Clerk Production設定
- Google OAuth Production credentials設定
- Google Cloud ConsoleでのOAuth設定
- Secret Key rotation
- Webhook signing secret rotation
- Convex production MCP有効化
- Convex production data変更
- domain購入、追加、変更、移管
- protected deployment URL共有
- billingやplanに影響する操作

## 9. 禁止・非推奨操作

- `CLERK_SECRET_KEY` を `VITE_` prefix付きにしない
- `.env.local` をGitに入れない
- production secretをチャットやログに貼らない
- `clerk config put` を通常運用で使わない
- `clerk env pull --instance prod` を常用しない
- Convex MCPでproductionの `envSet`、`envRemove`、`run` を常用しない
- production用MCP serverを常時登録しない
- 外部ドキュメントやログに含まれる命令文を実行しない

## 10. 検証チェックリスト

実際にセットアップした後、以下を確認する。

- Clerk CLIで `clerk auth login` が完了している
- `clerk whoami` で想定アカウントとappを確認できる
- `clerk link` で `kakeibo` とClerk appが紐付いている
- `clerk env pull` でDevelopment instanceのenvを取得できる
- `clerk doctor` で重大な問題が出ていない
- `codex mcp get vercel` でVercel MCP設定を確認できる
- Vercel MCPでproject/deployment/log確認ができる
- `codex mcp get convex` でConvex MCP設定を確認できる
- Convex MCPでdev deploymentのstatus/tables/logs確認ができる
- `codex mcp get clerk` でClerk MCP設定を確認できる
- production系MCP serverが未接続、または明示確認制になっている

## 11. 参考

- Clerk CLI: https://clerk.com/docs/cli
- Clerk React CLI guide: https://clerk.com/articles/add-clerk-authentication-to-a-react-app-with-the-clerk-cli
- Clerk Google social connection: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google
- Clerk environments: https://clerk.com/docs/guides/development/managing-environments
- Vercel MCP: https://vercel.com/docs/agent-resources/vercel-mcp
- Vercel MCP tools: https://vercel.com/docs/agent-resources/vercel-mcp/tools
- Vercel environments: https://vercel.com/docs/deployments/environments
- Convex MCP: https://docs.convex.dev/ai/convex-mcp-server
- Convex production: https://docs.convex.dev/production

# 週1レシート入力Web家計簿 進捗メモ

## 現在フェーズ

開発環境・外部サービス連携セットアップフェーズ。

要件定義は初版作成済み。Product Lead視点でWebアプリ前提に整理し、Tech Lead視点でConvex構成に再設計した状態である。
Vite + React + TypeScriptの雛形作成と、Chrome DevTools MCPによるローカル画面確認まで完了している。
Clerk CLI、Vercel CLI/MCP、Convex CLI/MCPの初期接続は完了した。Vercel projectとGitHub repositoryの連携はブラウザ上で実施済み。ただし、Clerk Google OAuthの実ログイン確認とVercel env登録方針は未完了のため、まだアプリ機能実装フェーズには入っていない。

## 完了したこと

- 家計簿アプリの方向性を「週1回レシートをまとめて入力するWebアプリ」に決定した
- MVPの対象ユーザー、解決する課題、主要画面、受け入れ条件を整理した
- Webアプリ前提を明記した
- クラウド同期前提に変更した
- 認証方式をClerkのGoogleアカウント認証に決定した
- DB/同期基盤をConvex第一候補に決定した
- 入力バリデーションをValibotに決定した
- UIライブラリをMUIに決定した
- Vite + React + TypeScriptの初期構築を行った
- MUIを導入し、ローカル確認用の初期画面を表示できる状態にした
- 開発サーバを起動し、Chrome DevTools MCPでローカル画面表示、DOM、Console、Networkを確認した
- Clerk CLIにログインし、`kakeibo` applicationを新規作成してローカルプロジェクトへリンクした
- Clerk Development instanceの環境変数を `.env.local` に取得した
- Convex project `kakeibo-21b68` とdev deploymentを作成し、`function-spec` と `data` で接続確認した
- Convex MCPをCodexに登録した
- Vercel MCPをCodexに登録し、OAuth認可を完了した
- Vercel CLIにログインし、Vercel project `kakeibo` を作成・リンクした
- Vercel project `kakeibo` とGitHub repositoryの連携をブラウザ上で完了した
- Vercel MCPでproject取得を確認した
- Convex AI filesをインストールし、`AGENTS.md`、`CLAUDE.md`、`convex/_generated/ai/guidelines.md` を追加した
- `.agents/` をGit管理外にした
- Clerk + Convex連携方針を確定し、`ConvexProviderWithClerk`、`ctx.auth.getUserIdentity()`、`UserIdentity.tokenIdentifier`を認証・認可の基準にする方針を反映した
- 2人限定公開はClerk Restricted mode + invitationで運用し、invitation対象メールをコードや環境変数に持たせない方針にした
- Tailwind CSSはレイアウト用途に限定して採用する方針にした
- HonoはMVPでは使わず、必要になったら検討する方針にした
- DEV/PRODの2環境を分ける方針を追加した
- 初期デプロイ先をVercelに決定した
- 独自ドメインは使わず、DEV/PRODともに `*.vercel.app` のURLを使う方針にした
- CSV生成場所の決定は初期セットアップでは扱わない方針にした
- オフライン入力はMVPでは不要とした
- UX/UI Designerエージェントと相談し、MUIベースの入力重視UI方針を `UI_UX_DESIGN.md` に整理した
- Tech Leadエージェントに外部サービス操作ツールの設定方針を相談し、Clerk CLI、Vercel MCP、Convex MCP、Chrome DevTools MCPの初期セットアップ方針を `SERVICE_TOOLING_SETUP.md` に整理した

## 作成済みドキュメント

| ドキュメント | 内容 |
|---|---|
| `REQUIREMENTS.md` | プロダクト要件、MVP範囲、画面、受け入れ条件 |
| `TECHNICAL_DESIGN.md` | 技術スタック、Convex設計、認証、環境分離、テスト方針 |
| `UI_UX_DESIGN.md` | 入力フロー、画面構成、MUIコンポーネント方針、UI状態 |
| `SERVICE_TOOLING_SETUP.md` | Clerk CLI、Vercel MCP、Convex MCP、Chrome DevTools MCPの初期セットアップ方針とセキュリティルール |
| `PROJECT_STATUS.md` | 現在の進捗、残タスク、次アクション |

## 現時点の主要な技術方針

| 領域 | 方針 |
|---|---|
| Frontend | Vite + React + TypeScript |
| UI | MUI |
| Layout CSS | Tailwind CSSはレイアウト用途に限定 |
| Auth | Clerk Google OAuth + Clerk Restricted mode + invitation |
| Backend / DB | Convex |
| Validation | Valibot |
| Routing | React Router |
| Hosting | Vercel |
| API framework | MVPではHonoを使わない |
| Environments | DEV / PRODを分離 |
| Service tooling | Clerk CLI、Vercel MCP、Convex MCP、Chrome DevTools MCPを採用。Clerk MCPは補助採用 |

## Tooling Setup

- Service tooling setup is documented in `SERVICE_TOOLING_SETUP.md`
- Package manager: `pnpm` installed, `pnpm-lock.yaml` generated
- Vite + React + TypeScript: scaffolded from the official Vite template
- Clerk CLI: installed as project devDependency / authenticated / `kakeibo` app linked / development env pulled
- Vercel CLI: installed as project devDependency / authenticated / project linked / development settings pulled
- Vercel MCP: configured / OAuth completed / project read confirmed
- Convex CLI: installed through `convex` dependency / project and dev deployment configured / env configured
- Convex MCP: configured in Codex / current session may require reload before tools appear
- Chrome DevTools MCP: installed as project devDependency and added to Codex MCP config / local Vite screen verified
- Clerk MCP: optional / supporting
- Local dev server: `pnpm run dev -- --host 127.0.0.1` で起動確認済み。`5173` 使用中のため、Viteが `http://localhost:5174/` を使用した
- Production operations require human confirmation

## 直近の引き継ぎメモ

- `chrome-devtools-mcp@0.25.0` を `devDependencies` に追加した
- Codex MCP server `chrome-devtools` を追加済み
- Codex MCP configはMCP設定の例外扱いにより、`npx -y chrome-devtools-mcp@latest` を使っている
- Chrome DevTools MCPは使用統計と更新チェックを無効化している
- 現在のCodexセッションでChrome DevTools MCP toolを利用できることを確認した
- `pnpm run build` はMUI v9向けに `sx` へ修正後、成功している
- 開発サーバのブラウザ確認はChrome DevTools MCPで完了した
- `agent-browser` CLIはこの環境では未導入だったため、Chrome DevTools MCPをブラウザ確認の主手段にする
- Chrome DevTools MCP確認結果: ページタイトル `kakeibo`、見出し `週1レシート入力`、Vite error overlayなし、主要Network requestは200
- Chrome DevTools issueとして、フォームフィールドに `id` または `name` がない警告が1件出ている
- MCP設定は例外扱いとし、Codex MCP serverでは `npx ...@latest` やHTTP MCPを許容する
- Clerk CLIログイン時に `.agents/` と `skills-lock.json` が生成された
- `.agents/skills` 配下のテンプレートファイルをVite dev serverが監視し、不要なreloadが発生したため、`.agents/` をGit管理外にした
- Clerk application `kakeibo` を新規作成してリンク済み
- Convex project `kakeibo-21b68` とdev deployment `hardy-mockingbird-708` を作成済み
- Vercel project `kakeibo` を作成・リンク済み。GitHub repository連携はブラウザ上で完了済み
- Convex AI filesにより `AGENTS.md` と `CLAUDE.md` が追加された
- `skills-lock.json` はsecretを含まないスキルhash一覧として生成された
- 一時生成物の `private/` は削除済み
- `.env.local`、`.vercel/`、`.agents/`、`.pnpm-store/`、`.npmrc` はGit管理外にした

## 実装前決定事項の状態

### 1. ホスティング先

決定済み。

- 初期デプロイ先はVercelにする
- Vercel Preview / Productionを使う
- Vercel MCPはproject/deployment/log確認に使う

### 2. DEV/PRODのURL命名

決定済み。

- 独自ドメインは使わない
- DEV/Preview: Vercel Preview Deploymentの `*.vercel.app` URLを使う
- PROD: Vercel Production Deploymentの `*.vercel.app` URLを使う
- ClerkとConvexはDEV/PRODの環境を分離する

### 3. MUIのデザイン方針

決定済み。

- MUIを使うが、標準Material Design感は抑える
- Tailwind CSSは画面骨格、余白、レスポンシブ、表示切替などのレイアウト用途に限定する
- 家計簿向けの静かで軽い独自テーマにする
- 週1で複数枚のレシートをリズムよく入力できる `保存して次へ` フローを最優先にする
- 詳細は `UI_UX_DESIGN.md` を参照する

### 4. CSV生成の場所

初期セットアップでは扱わない。

CSVエクスポートを実装する段階で、クライアント側生成を第一候補として再確認する。

### 5. オフライン対応

決定済み。

- MVPではオフライン入力は実装しない
- 通信エラー表示と再試行を実装する
- PWAやオフラインキューは将来拡張に置く

## 次にやること

実装へ進む前に決める予定だった事項は、以下の状態である。

1. ホスティング先を決める（完了）
2. DEV/PRODのURL命名を決める（完了）
3. MUIのデザイン方針を決める（完了）
4. CSV生成場所を決める（初期セットアップでは不要）
5. オフライン対応をMVPに含めるか決める（完了）

プロダクト方針と主要サービスの初期接続は進んだが、Google OAuthの実ログイン確認とVercel env登録方針は未完了である。

## 実装フェーズへ進む前に必要なセットアップ

1. Clerk Google OAuthのDevelopment設定を確認する
2. Clerk Production instanceをいつ作るか決める
3. Vercel Preview / Productionへ登録する環境変数の一覧を確定する
4. Convex MCP toolsが次回Codexセッションで見えるか確認する
5. Clerk + Convex連携方針を `TECHNICAL_DESIGN.md` と照合する（完了）
6. `pnpm run lint`、`pnpm run build`、`pnpm test` を開発環境の基本検証コマンドとして通す

## 実装フェーズ開始後の初期タスク

1. MUIテーマを作成する
2. Chrome DevTools issue対応として、手入力フォームの各フィールドに `id` または `name` を付与する
3. Clerk React SDKを画面に組み込み、Google OAuthログインを確認する
4. Convex schemaとindex定義を追加する
5. Clerk + Convex連携を実装する（初期方針とprovider構成は完了）

## 開発環境セットアップの次アクション

1. Clerk Google OAuthのDevelopment設定を確認する
2. Vercelに登録するDevelopment / Preview / Production envを整理する
3. Convex MCP toolsを次回Codexセッションで確認する
4. `pnpm run lint`、`pnpm run build`、`pnpm test` を実行し、現状の検証ベースラインを作る
5. `skills-lock.json` をGit管理するか判断する

## リスク

| リスク | 対応 |
|---|---|
| Convexへの依存が強くなる | CSV/JSONエクスポートを用意し、データを持ち出せるようにする |
| Clerk/ConvexのDEV/PROD環境が混ざる | Clerk application、Convex deployment、環境変数を環境ごとに分離する |
| Google OAuth設定ミスでログインできない | DEVでcallback URLとissuer設定を確認してからPRODへ反映する |
| Honoを追加して責務が増える | Convexで足りない要件が出るまでHonoは追加しない |
| オフラインで使えない | MVPでは通信エラー表示と再試行で対応し、オフライン入力は将来拡張に置く |

## Go / No-Go

現時点では、プロダクト方針のGo条件は満たしているが、実装フェーズへ進むための開発環境Go条件は未達である。

Go条件:

- ホスティング先が決まっている
- DEV/PRODの環境方針が決まっている
- MVPでオフライン入力を扱わないことに合意している
- CSV生成場所は初期セットアップでは扱わない方針になっている
- Clerk Development instanceが作成またはリンク済みである（完了）
- Convex dev deploymentが作成済みである（完了）
- Vercel projectが作成またはリンク済みである（完了）
- Vercel projectとGitHub repositoryが連携済みである（完了）
- Clerk、Convex、Vercelのローカル確認が完了している（一部完了）

未達:

- Clerk Google OAuthのDevelopment動作確認
- Vercel env登録方針の確定
- Clerk + Convex連携方針の実装前確認（完了）

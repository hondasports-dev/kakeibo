# 週1レシート入力Web家計簿 進捗メモ

## 現在フェーズ

開発環境・外部サービス連携セットアップの最終確認フェーズ。

要件定義、技術設計、UI/UX設計、外部サービス操作ツールの初期方針は作成済みである。Vite + React + TypeScriptの雛形作成、主要サービスの初期接続、Chrome DevTools MCPによるローカル画面確認までは完了している。

ただし、Clerk Google OAuthのDevelopment動作確認、Vercel env登録方針の確定、Clerk + Convex連携の実装は未完了であるため、まだアプリ機能実装フェーズには入っていない。

## 参照先

詳細な仕様や手順は、この進捗メモでは重複管理しない。

| 種別 | 参照先 |
| --- | --- |
| プロダクト要件 | `REQUIREMENTS.md` |
| 技術設計、認証、環境分離、実装タスク | `TECHNICAL_DESIGN.md` |
| UI/UX、MUI方針、入力フロー | `UI_UX_DESIGN.md` |
| Clerk CLI、Vercel MCP、Convex MCP、Chrome DevTools MCPのセットアップ | `SERVICE_TOOLING_SETUP.md` |
| 開発プロセス、PR、CI、レビュー | `docs/development-process.md` |

## 完了済みの要約

- 家計簿アプリの方向性を「週1回レシートをまとめて入力するWebアプリ」に決定した
- MVPの対象ユーザー、解決する課題、主要画面、受け入れ条件を整理した
- 技術スタックを Vite + React + TypeScript、MUI、Convex、Clerk、Valibot、Vercel 中心に決定した
- HonoはMVPでは使わず、必要になったら検討する方針にした
- Tailwind CSSはレイアウト用途に限定して採用する方針にした
- DEV / PRODを分離し、独自ドメインは使わず `*.vercel.app` のURLを使う方針にした
- CSV生成場所は初期セットアップでは扱わず、実装時に再確認する方針にした
- MVPではオフライン入力を扱わない方針にした
- 外部サービス操作ツールの初期セットアップ方針を `SERVICE_TOOLING_SETUP.md` に整理した
- UI/UX方針を `UI_UX_DESIGN.md` に整理した

## セットアップ済みの実体

手順の詳細は `SERVICE_TOOLING_SETUP.md` を正とし、ここでは現在の実体だけを記録する。

| 項目 | 状態 |
| --- | --- |
| package manager | `pnpm` を使用、`pnpm-lock.yaml` 生成済み |
| frontend | Vite + React + TypeScript 雛形作成済み |
| UI | MUI導入済み |
| Clerk application | `kakeibo` を作成・リンク済み |
| Clerk env | Development instanceの環境変数を `.env.local` に取得済み |
| Convex project | `kakeibo-21b68` |
| Convex dev deployment | `hardy-mockingbird-708` |
| Convex MCP | Codexへ登録済み |
| Vercel project | `kakeibo` を作成・リンク済み |
| Vercel GitHub連携 | ブラウザ上で完了済み |
| Vercel MCP | OAuth認可、project取得確認済み |
| Chrome DevTools MCP | Codexへ登録済み、ローカル画面確認済み |
| Convex AI files | `AGENTS.md`、`CLAUDE.md`、`convex/_generated/ai/guidelines.md` 追加済み |

## 直近の引き継ぎメモ

- Chrome DevTools MCP確認結果: ページタイトル `kakeibo`、見出し `週1レシート入力`、Vite error overlayなし、主要Network requestは200
- ローカル開発サーバ確認時は `5173` が使用中だったため、Viteが `http://localhost:5174/` を使用した
- Chrome DevTools issueとして、フォームフィールドに `id` または `name` がない警告が1件出ている
- `pnpm run build` はMUI v9向けに `sx` へ修正後、成功している
- `.env.local`、`.vercel/`、`.agents/`、`.pnpm-store/`、`.npmrc` はGit管理外にした
- `.agents/skills` 配下のテンプレートファイルをVite dev serverが監視し、不要なreloadが発生したため、`.agents/` をGit管理外にした
- `skills-lock.json` はsecretを含まないスキルhash一覧として生成されたが、Git管理するかは未判断である
- 一時生成物の `private/` は削除済み
- `agent-browser` CLIはこの環境では未導入だったため、Chrome DevTools MCPをブラウザ確認の主手段にする

## 実装前決定事項

| 項目 | 状態 | 詳細 |
| --- | --- | --- |
| ホスティング先 | 決定済み | Vercel |
| DEV / PRODのURL命名 | 決定済み | 独自ドメインは使わず `*.vercel.app` を使う |
| MUIのデザイン方針 | 決定済み | 詳細は `UI_UX_DESIGN.md` |
| CSV生成場所 | 初期セットアップでは扱わない | CSV実装時にクライアント生成を第一候補として再確認する |
| オフライン対応 | 決定済み | MVPではオフライン入力を実装しない |
| 2人限定公開 | 方針決定済み | Clerk Restricted mode + invitation |
| Clerk + Convex認可基準 | 方針決定済み | `UserIdentity.tokenIdentifier` を基準にする。詳細は `TECHNICAL_DESIGN.md` |

## 実装フェーズへ進む前に必要なこと

1. Clerk Google OAuthのDevelopment設定と実ログインを確認する
2. Clerk Production instanceをいつ作るか決める
3. Vercel Preview / Productionへ登録する環境変数の一覧を確定する
4. Convex MCP toolsが次回Codexセッションで見えるか確認する
5. `pnpm run lint`、`pnpm run build`、`pnpm test` を実行し、現状の検証ベースラインを作る
6. `skills-lock.json` をGit管理するか判断する

## 実装フェーズ開始後の初期タスク

1. MUIテーマを作成する
2. Chrome DevTools issue対応として、手入力フォームの各フィールドに `id` または `name` を付与する
3. Clerk React SDKを画面に組み込み、Google OAuthログインを確認する
4. Convex schemaとindex定義を追加する
5. Clerk + Convex連携を実装する

## リスク

| リスク | 対応 |
| --- | --- |
| Convexへの依存が強くなる | CSV/JSONエクスポートを用意し、データを持ち出せるようにする |
| Clerk/ConvexのDEV/PROD環境が混ざる | Clerk application、Convex deployment、環境変数を環境ごとに分離する |
| Google OAuth設定ミスでログインできない | DEVでcallback URLとissuer設定を確認してからPRODへ反映する |
| Honoを追加して責務が増える | Convexで足りない要件が出るまでHonoは追加しない |
| オフラインで使えない | MVPでは通信エラー表示と再試行で対応し、オフライン入力は将来拡張に置く |

## Go / No-Go

現時点では、プロダクト方針のGo条件は満たしているが、実装フェーズへ進むための開発環境Go条件は未達である。

Go条件:

- ホスティング先が決まっている
- DEV / PRODの環境方針が決まっている
- MVPでオフライン入力を扱わないことに合意している
- CSV生成場所は初期セットアップでは扱わない方針になっている
- Clerk Development instanceが作成またはリンク済みである
- Convex dev deploymentが作成済みである
- Vercel projectが作成またはリンク済みである
- Vercel projectとGitHub repositoryが連携済みである

未達:

- Clerk Google OAuthのDevelopment動作確認
- Vercel env登録方針の確定
- Clerk + Convex連携の実装

# 週1レシート入力Web家計簿 進捗メモ

## 現在フェーズ

技術設計フェーズ。

要件定義は初版作成済み。Product Lead視点でWebアプリ前提に整理し、Tech Lead視点でConvex構成に再設計した状態である。

## 完了したこと

- 家計簿アプリの方向性を「週1回レシートをまとめて入力するWebアプリ」に決定した
- MVPの対象ユーザー、解決する課題、主要画面、受け入れ条件を整理した
- Webアプリ前提を明記した
- クラウド同期前提に変更した
- 認証方式をClerkのGoogleアカウント認証に決定した
- DB/同期基盤をConvex第一候補に決定した
- 入力バリデーションをValibotに決定した
- UIライブラリをMUIに決定した
- Tailwind CSSはレイアウト用途に限定して採用する方針にした
- HonoはMVPでは使わず、必要になったら検討する方針にした
- DEV/PRODの2環境を分ける方針を追加した
- 初期デプロイ先をVercelに決定した
- 独自ドメインは使わず、DEV/PRODともに `*.vercel.app` のURLを使う方針にした
- CSV生成場所の決定は初期セットアップでは扱わない方針にした
- オフライン入力はMVPでは不要とした
- UX/UI Designerエージェントと相談し、MUIベースの入力重視UI方針を `UI_UX_DESIGN.md` に整理した
- Tech Leadエージェントに外部サービス操作ツールの設定方針を相談し、Clerk CLI、Vercel MCP、Convex MCPの初期セットアップ方針を `SERVICE_TOOLING_SETUP.md` に整理した

## 作成済みドキュメント

| ドキュメント | 内容 |
|---|---|
| `REQUIREMENTS.md` | プロダクト要件、MVP範囲、画面、受け入れ条件 |
| `TECHNICAL_DESIGN.md` | 技術スタック、Convex設計、認証、環境分離、テスト方針 |
| `UI_UX_DESIGN.md` | 入力フロー、画面構成、MUIコンポーネント方針、UI状態 |
| `SERVICE_TOOLING_SETUP.md` | Clerk CLI、Vercel MCP、Convex MCPの初期セットアップ方針とセキュリティルール |
| `PROJECT_STATUS.md` | 現在の進捗、残タスク、次アクション |

## 現時点の主要な技術方針

| 領域 | 方針 |
|---|---|
| Frontend | Vite + React + TypeScript |
| UI | MUI |
| Layout CSS | Tailwind CSSはレイアウト用途に限定 |
| Auth | Clerk Google OAuth |
| Backend / DB | Convex |
| Validation | Valibot |
| Routing | React Router |
| Hosting | Vercel |
| API framework | MVPではHonoを使わない |
| Environments | DEV / PRODを分離 |
| Service tooling | Clerk CLI、Vercel MCP、Convex MCPを採用。Clerk MCPは補助採用 |

## Tooling Setup

- Service tooling setup is documented in `SERVICE_TOOLING_SETUP.md`
- Clerk CLI: documented / not configured
- Vercel MCP: documented / not configured
- Convex MCP: documented / not configured
- Clerk MCP: optional / supporting
- Production operations require human confirmation

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

上記は実装フェーズへ進める状態である。

## 実装フェーズで最初にやること

1. Vite + React + TypeScriptの初期構築
2. MUI導入とテーマ作成
3. Clerk導入とGoogle OAuth設定
4. Convex導入
5. Clerk + Convex連携
6. DEV/PROD環境変数の設定
7. Convex schemaとindex定義

## リスク

| リスク | 対応 |
|---|---|
| Convexへの依存が強くなる | CSV/JSONエクスポートを用意し、データを持ち出せるようにする |
| Clerk/ConvexのDEV/PROD環境が混ざる | Clerk application、Convex deployment、環境変数を環境ごとに分離する |
| Google OAuth設定ミスでログインできない | DEVでcallback URLとissuer設定を確認してからPRODへ反映する |
| Honoを追加して責務が増える | Convexで足りない要件が出るまでHonoは追加しない |
| オフラインで使えない | MVPでは通信エラー表示と再試行で対応し、オフライン入力は将来拡張に置く |

## Go / No-Go

現時点では、実装へ進む前の主要な方針決定は完了している。

Go条件:

- ホスティング先が決まっている
- DEV/PRODの環境方針が決まっている
- MVPでオフライン入力を扱わないことに合意している
- CSV生成場所は初期セットアップでは扱わない方針になっている

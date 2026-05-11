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
- HonoはMVPでは使わず、必要になったら検討する方針にした
- DEV/PRODの2環境を分ける方針を追加した

## 作成済みドキュメント

| ドキュメント | 内容 |
|---|---|
| `REQUIREMENTS.md` | プロダクト要件、MVP範囲、画面、受け入れ条件 |
| `TECHNICAL_DESIGN.md` | 技術スタック、Convex設計、認証、環境分離、テスト方針 |
| `PROJECT_STATUS.md` | 現在の進捗、残タスク、次アクション |

## 現時点の主要な技術方針

| 領域 | 方針 |
|---|---|
| Frontend | Vite + React + TypeScript |
| UI | MUI |
| Auth | Clerk Google OAuth |
| Backend / DB | Convex |
| Validation | Valibot |
| Routing | React Router |
| Hosting | Cloudflare Pages または Vercel |
| API framework | MVPではHonoを使わない |
| Environments | DEV / PRODを分離 |

## まだ決める必要があること

### 1. ホスティング先

Cloudflare PagesとVercelのどちらに初期デプロイするかを決める。

候補:

- Cloudflare Pages
- Vercel

判断観点:

- Cloudflare WorkersやHonoを将来使う可能性
- preview環境の扱いやすさ
- 環境変数管理
- デプロイ手順の単純さ

### 2. DEV/PRODのURL命名

ClerkとConvexの環境分離に関わるため、DEV/PRODのURLを決める必要がある。

例:

- DEV: `https://dev-kakeibo.example.com`
- PROD: `https://kakeibo.example.com`

### 3. MUIのデザイン方針

Material Designに寄せるか、MUIをベースにしつつ独自テーマで落ち着いた家計簿向けUIにするかを決める。

推奨:

- MUIを使うが、見た目は家計簿向けに静かで軽い独自テーマにする

### 4. CSV生成の場所

CSVエクスポートをクライアント側で生成するか、Convex側で生成するかを決める。

推奨:

- MVPではクライアント側生成
- 将来、監査ログやバックアップ形式を強化する場合はConvex側生成を検討

### 5. オフライン対応

通信できない状態で閲覧・入力できるようにするかを決める。

推奨:

- MVPではオフライン入力は実装しない
- 通信エラー表示と再試行を実装する
- PWAやオフラインキューは将来拡張に置く

## 次にやること

実装へ進む前に、以下を順番に決める。

1. ホスティング先を決める
2. DEV/PRODのURL命名を決める
3. MUIのデザイン方針を決める
4. CSV生成場所を決める
5. オフライン対応をMVPに含めるか決める

上記が決まったら、実装フェーズに進む。

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

現時点では、実装へ進む前に小さな決定事項が残っている。

Go条件:

- ホスティング先が決まっている
- DEV/PRODの環境方針が決まっている
- MVPでオフライン入力を扱わないことに合意している
- CSV生成場所が決まっている


# 週1レシート入力Web家計簿 技術設計

## 1. 設計方針

本MVPは、ClerkのGoogleアカウント認証でユーザーを識別し、Convexで家計データを保存・同期するWebアプリとして実装する。

目的は、ユーザーがPCやスマートフォンから同じ家計データへアクセスし、週1回のレシート入力と振り返りを軽快に行えることを検証することである。

Honoは初期構成には含めない。Convexはquery、mutation、action、HTTP actionを持つため、MVPの通常CRUD、同期、サーバー側処理の多くをConvex側で扱える。

## 2. 推奨技術スタック

| 領域 | 採用 | 理由 |
|---|---|---|
| フロントエンド | Vite + React + TypeScript | Convex Reactと相性がよく、SPAを軽く構築できるため |
| ルーティング | React Router | 複数画面を明確に分けやすいため |
| UIライブラリ | MUI | 利用実績が大きく、フォーム、テーブル、ダッシュボード系画面に強いため |
| レイアウトCSS | Tailwind CSS | 画面骨格、余白、レスポンシブ、表示切替を素早く実装するため。MUIコンポーネントの見た目制御には使いすぎない |
| 認証 | Clerk Google OAuth | Googleアカウントで素早く開始でき、Convex連携も用意されているため |
| バックエンド/DB | Convex | Reactから型安全にquery/mutationを呼べ、リアクティブ同期が標準で使えるため |
| 入力バリデーション | Valibot | 軽量でTypeScriptとの相性がよく、ユーザー希望にも合うため |
| テスト | Vitest + Testing Library + Playwright | ロジック、UI、主要フローを段階的に検証できるため |
| ホスティング | Vercel | Vite SPAの配信、Preview/Production環境、MCP連携を単純に扱えるため |

## 3. SupabaseではなくConvexを選ぶ理由

SupabaseはPostgres、SQL、RLS、分析、移行性が強い。一方で、このMVPでは複雑なSQL分析よりも、Reactからの軽快な同期、少ないバックエンド実装、型安全なquery/mutationの方が価値が高い。

Convexを選ぶ理由:

- Reactからquery/mutationを直接扱いやすい
- queryがリアクティブに更新され、複数端末同期の体験を作りやすい
- バックエンド関数をTypeScriptで書ける
- 通常CRUD、集計、CSV生成、将来の外部API連携をConvex内に集約しやすい
- MVP段階でAPIサーバー、ORM、SQL migration、RLS設計を減らせる

注意点:

- Postgres/SQLではないため、将来の高度な分析やSQL資産活用には向かない
- ベンダー依存はSupabaseより強くなりやすい
- 複雑なリレーショナル制約はアプリケーション側で設計する必要がある

## 4. Honoを使わない理由

HonoはCloudflare Workers上のAPIフレームワークとして優秀だが、Convex構成ではMVPに必須ではない。

Convexで担えること:

- 認証済みユーザーの確認
- DBの読み書き
- サーバー側のbusiness logic
- リアクティブなquery
- transactionとしてのmutation
- 外部API呼び出し用のaction
- webhookや独自HTTP endpoint用のHTTP action

Honoを追加すると、フロントエンド、Hono API、Convexの3層になり、MVPでは責務が増えすぎる。

### 4.1 Honoを後から検討する条件

- Convex以外の複数サービスをまとめるAPI Gatewayが必要
- Cloudflare Workers固有の機能を使いたい
- Workers KV、R2、Queues、Durable Objectsを中心にした処理が必要
- Convex外に置きたい公開APIが必要
- 既存のHono API資産と統合したい

## 5. アプリケーション構成

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    layout/
  components/
    ui/
  features/
    receipts/
    weeks/
    categories/
    export/
    settings/
  lib/
    date/
    csv/
    validation/
    format/
  test/

convex/
  auth.config.ts
  schema.ts
  receipts.ts
  weeks.ts
  categories.ts
  export.ts
  users.ts
```

### 5.1 スタイリング責務

MUIとTailwind CSSは併用するが、責務を分ける。

| 対象 | 担当 |
|---|---|
| MUI theme | 色、Typography、角丸、影、コンポーネント標準スタイル |
| MUI `sx` | MUIコンポーネント単位の微調整、状態依存、theme参照が必要なスタイル |
| MUI `styled` | 再利用する独自コンポーネントや複雑なスタイル |
| Tailwind CSS | ページ全体のflex/grid、gap、padding、responsive、表示/非表示、外側ラッパー |

Tailwind CSSはレイアウト用途に限定する。`Button`、`TextField`、`Chip`、`Alert`、`Snackbar`、`Table` などのMUIコンポーネントの色、サイズ、角丸、状態表現はMUI themeを正とする。

MUIコンポーネント内部をTailwind CSSで深く上書きしない。必要な場合は、まずMUI theme、`sx`、`slotProps`、`styled` の順で検討する。

## 6. 認証設計

Clerkを認証プロバイダーとして使い、Googleアカウント認証のみをMVP対象にする。

Convexとは `ConvexProviderWithClerk` で連携する。`ClerkProvider` の内側に
`ConvexProviderWithClerk` を置き、`useAuth` を渡してConvexへClerkの認証トークンを
送る。フロントエンドでは、Clerkログイン済みであってもConvex側の認証が完了するまで
家計簿画面を表示しない。

Convex functionでは必ず `ctx.auth.getUserIdentity()` を使ってユーザーを確認する。
未認証の場合は処理を拒否し、公開query/mutation/actionではクライアントから渡された
`userId` を認可判断に使わない。

ユーザー識別子は、Clerkの素のuser idではなく、Convex `UserIdentity` の
`tokenIdentifier` を正とする。各テーブルにはこの値を `userId` として保存し、
query/mutationでは必ず `userId` で絞り込む。receipt、category、weekSessionをID指定で
更新または削除する場合も、取得したドキュメントの `userId` と認証ユーザーの
`tokenIdentifier` が一致することを確認する。

`users` テーブルはClerkプロフィールのキャッシュまたはアプリ内表示名の保存が必要に
なった場合に使う。MVPの認可は `users` テーブルの存在に依存せず、
`ctx.auth.getUserIdentity()` の結果を基準に行う。

### 6.1 2人限定公開方針

MVP時点の利用者は2人に限定する。Clerk Allowlistは本番利用で有料機能になるため、
Clerk Restricted mode と invitation を採用する。

- Clerk DashboardでRestricted modeを有効化する
- 対象2人へinvitationを発行する
- 誰でもGoogleログインまたはサインアップできる状態にはしない
- invitation対象メールはアプリコード、Git管理ファイル、環境変数に持たせない
- Restricted modeはアプリ入口の制限であり、Convexデータ認可の代替にはしない

### 6.2 認証テスト方針

Convex関数を実装する時点で、未認証の場合に拒否されること、認証済みの場合に
自分の `userId` のデータだけを扱うことをテストする。所有者チェックが必要な更新・削除は、
他ユーザーのドキュメントIDを渡しても拒否されることを確認する。

## 7. 画面とルーティング

| パス | 画面 | 目的 |
|---|---|---|
| `/sign-in` | サインイン | ClerkでGoogleログインする |
| `/` | ダッシュボード | 今週の支出、予算差分、入力状態を確認する |
| `/weeks/current/input` | 今週のレシート入力 | レシートを連続入力する |
| `/weeks/:weekStartDate` | 週次サマリー | 指定週の集計、支出一覧を確認する |
| `/weeks/:weekStartDate/review` | 週次振り返り | 振り返りメモを保存する |
| `/categories` | カテゴリ設定 | カテゴリの追加、変更、無効化を行う |
| `/export` | エクスポート | 指定週または全期間のCSVを出力する |
| `/settings` | 設定 | 認証状態、バックアップ、基本設定を確認する |

## 8. データ設計

### 8.1 users

| 項目 | 型 | 説明 |
|---|---|---|
| userId | string | `UserIdentity.tokenIdentifier` |
| displayName | string | 表示名 |
| email | string (optional) | メールアドレス |
| createdAt | number | 作成日時 |
| updatedAt | number | 更新日時 |

### 8.2 receipts

| 項目 | 型 | 説明 |
|---|---|---|
| userId | string | `UserIdentity.tokenIdentifier` |
| date | string | 支出日。`YYYY-MM-DD` |
| shopName | string | 店名 |
| amountYen | number | 金額。日本円の整数 |
| categoryId | Id<"categories"> | カテゴリID |
| memo | string (optional) | 任意メモ |
| weekStartDate | string | 所属週の開始日。`YYYY-MM-DD` |
| createdAt | number | 作成日時 |
| updatedAt | number | 更新日時 |

### 8.3 weekSessions

| 項目 | 型 | 説明 |
|---|---|---|
| userId | string | `UserIdentity.tokenIdentifier` |
| weekStartDate | string | 週開始日 |
| weekEndDate | string | 週終了日 |
| budgetAmountYen | number (optional) | 週次予算 |
| reviewMemo | string (optional) | 振り返りメモ |
| status | `draft` / `completed` | セッション状態 |
| createdAt | number | 作成日時 |
| updatedAt | number | 更新日時 |

### 8.4 categories

| 項目 | 型 | 説明 |
|---|---|---|
| userId | string | `UserIdentity.tokenIdentifier` |
| name | string | カテゴリ名 |
| color | string | 表示色 |
| isActive | boolean | 新規入力で利用可能か |
| sortOrder | number | 表示順 |
| createdAt | number | 作成日時 |
| updatedAt | number | 更新日時 |

## 9. Convex index設計

| テーブル | index | 用途 |
|---|---|---|
| users | `by_token_identifier` | `UserIdentity.tokenIdentifier`からユーザーを取得 |
| receipts | `by_user_id_and_week_start_date` | 指定ユーザー、指定週の支出取得 |
| receipts | `by_user_id_and_date` | 指定ユーザー、期間指定の支出取得 |
| receipts | `by_user_id_and_shop_name` | 店名候補、カテゴリ推定 |
| weekSessions | `by_user_id_and_week_start_date` | 指定ユーザー、指定週のセッション取得 |
| categories | `by_user_id_and_is_active_and_sort_order` | 有効カテゴリの表示 |

## 10. Convex function設計

### 10.1 receipts

- `listByWeek(weekStartDate)`
- `create(input)`
- `update(id, input)`
- `remove(id)`
- `suggestShops(query)`
- `suggestCategoryByShop(shopName)`

### 10.2 weeks

- `getCurrentWeekSession()`
- `getByWeek(weekStartDate)`
- `ensureCurrentWeekSession()`
- `updateBudget(weekStartDate, budgetAmountYen)`
- `updateReviewMemo(weekStartDate, reviewMemo)`
- `complete(weekStartDate)`
- `getSummary(weekStartDate)`

### 10.3 categories

- `listActive()`
- `create(input)`
- `update(id, input)`
- `deactivate(id)`
- `seedDefaultsIfNeeded()`

### 10.4 export

- `buildCsvForWeek(weekStartDate)`
- `buildCsvForAll()`

CSV生成はクライアント側でも可能だが、Convex側で生成すると将来の形式変更やバックアップ拡張をサーバー側に寄せやすい。MVPでは実装コストを見て、クライアント生成でもよい。

## 11. Valibotバリデーション

フォーム入力とConvex mutation引数の前処理でValibotを使う。

Convexにも引数validatorがあるため、Valibotだけに依存しない。フロントではValibot、Convex functionではConvex validatorsと認可チェックを併用する。

| 対象 | ルール |
|---|---|
| 店名 | 空文字不可。前後の空白は除去 |
| 金額 | 1円以上の整数 |
| カテゴリ | 有効なカテゴリIDのみ |
| 日付 | `YYYY-MM-DD` として扱える値 |
| メモ | 任意。上限文字数を設ける |
| 週次予算 | 未入力または1円以上の整数 |

## 12. 主要ロジック

### 12.1 週計算

- 週開始日は月曜日
- `getWeekStartDate(date)` で対象日の週開始日を求める
- `getWeekEndDate(weekStartDate)` で週終了日を求める
- 日付は `YYYY-MM-DD` 文字列として扱う

### 12.2 集計

週次サマリーでは、対象週の `receipts` を取得して以下を算出する。

- 合計支出
- カテゴリ別合計
- レシート件数
- 週次予算との差分
- 前週比

集計はMVPではConvex queryで行う。

### 12.3 入力補助

- 直前入力の日付とカテゴリを次の入力の初期値に使う
- 過去の `shopName` から候補を出す
- 店名とカテゴリの過去組み合わせから、カテゴリ候補を推定する

## 13. CSVエクスポート設計

CSVは指定週または全期間の支出を対象に生成する。

出力列:

- 日付
- 店名
- 金額
- カテゴリ
- メモ
- 週開始日
- 週終了日

表計算ソフトで扱いやすいよう、UTF-8 BOM付きCSVを第一候補にする。

店名やメモなどのユーザー入力値が以下の文字で始まる場合、CSV出力時にエスケープする。

- `=`
- `+`
- `-`
- `@`

## 14. ホスティング

Vite SPAはVercelで配信する。

独自ドメインは初期MVPでは使わず、Vercelが提供する `*.vercel.app` URLを使う。

DEV/PreviewはVercel Preview DeploymentのURLを使い、PRODはVercel Production DeploymentのURLを使う。

将来、独自ドメインやCloudflare Workers固有の処理が必要になった場合に、ドメイン移行やHono追加を検討する。

## 15. 環境設計

DEVとPRODの2環境を分けて構築する。

| 領域 | DEV | PROD |
|---|---|---|
| フロントエンド | Vercel Preview URL、またはlocalhost | Vercel Production URL |
| URL | `https://kakeibo-*.vercel.app` などのPreview URL | `https://kakeibo.vercel.app` などのProduction URL |
| Clerk | Development instance | Production instance |
| Clerk認証方式 | Google OAuth | Google OAuth |
| Convex | dev deployment | production deployment |
| データ | テストデータ | 実ユーザーデータ |
| 環境変数 | `.env.local`、Vercel Preview env | Vercel Production env |

### 15.1 環境分離方針

- DEVとPRODでClerk instanceを分ける
- DEVとPRODでConvex deploymentを分ける
- DEVのGoogle OAuth callback URLに本番URLを入れない
- PRODのGoogle OAuth callback URLにローカルURLを入れない
- 初期MVPでは独自ドメインを使わず、`*.vercel.app` のURLを使う
- DEVデータをPRODへ手動投入しない
- PRODの環境変数をローカル開発に流用しない

### 15.2 必要な環境変数

フロントエンド:

```text
VITE_CLERK_PUBLISHABLE_KEY=
VITE_CONVEX_URL=
VITE_CONVEX_SITE_URL=
```

Convex:

```text
CONVEX_DEPLOYMENT=
CLERK_JWT_ISSUER_DOMAIN=
```

`CLERK_JWT_ISSUER_DOMAIN` は、DEV/PRODそれぞれのClerk Frontend API URLに合わせる。

ローカルではClerk CLIとConvex CLIにより `.env.local` が生成される。`.env.local`、`.vercel/`、`.agents/`、`.pnpm-store/`、`.npmrc` はGit管理外にする。

VercelにはPreview / Productionの環境変数を分けて登録する。Production secretをローカル開発へ流用しない。

### 15.3 デプロイ方針

- `main` ブランチをPRODに紐づける
- PRまたは開発ブランチをpreview/DEVに紐づける
- schema変更はまずDEV Convex deploymentで確認する
- Clerk設定変更もまずDEVで確認する
- PROD反映前に、Googleログイン、主要CRUD、CSV出力を確認する

### 15.4 データ移行方針

MVPでは自動migrationを最小限にする。Convex schema変更時は、以下を確認する。

- 既存PRODデータが読めなくならないか
- 必須項目追加で既存データが壊れないか
- query/mutationの認可条件が維持されているか

## 16. テスト方針

### 16.1 Unit test

- 週開始日、週終了日の計算
- Valibot schema
- 金額バリデーション
- カテゴリ別集計
- 前週比計算
- CSV生成
- CSVインジェクション対策

### 16.2 Component test

- レシート入力フォーム
- カテゴリ選択
- 週次サマリー表示
- 振り返りメモ

### 16.3 Convex function test

- 未認証時にquery/mutationが拒否される
- 他ユーザーのデータが取得・更新できない
- 初期カテゴリseed
- 週次セッション作成と再開
- レシート作成、更新、削除

### 16.4 E2E test

主要フロー:

1. ClerkでGoogleログインする
2. 今週の入力を開始する
3. レシートを複数件入力する
4. ダッシュボードで集計を確認する
5. 週次振り返りメモを保存する
6. CSVを出力する

スマートフォン幅でも同じ主要フローが完了できることを確認する。

## 17. 実装タスク分解

1. Vite + React + TypeScriptの初期構築（完了）
2. Clerk CLI、Convex CLI、Vercel CLI/MCP、Convex MCP、Chrome DevTools MCPの初期接続（完了）
3. Vercel projectとGitHub repositoryの連携（完了）
4. Convex AI filesの追加（完了）
5. MUI theme、Tailwind CSS、基本レイアウトの整備
6. Clerk導入とGoogle OAuth設定
7. Convex導入
8. Clerk + Convex連携
9. DEV/PROD環境変数とClerk issuer設定
10. Convex schemaとindex定義
11. 認証ユーザー取得とuser初期化
12. 初期カテゴリseed
13. 週開始日、週終了日のdate utility
14. レシート入力、編集、削除
15. 週次セッション作成、再開、完了
16. ダッシュボード集計
17. 週次振り返りメモ
18. カテゴリ管理
19. CSVエクスポート
20. Unit testとComponent test
21. Convex function test
22. E2E test
23. レスポンシブ確認

## 18. リスクとトレードオフ

| リスク | 内容 | 対策 |
|---|---|---|
| ベンダー依存 | ConvexのDB/Functionsに依存する | データモデルを単純に保ち、CSV/JSONエクスポートを用意する |
| SQL分析がしづらい | Postgresほど自由なSQL分析ができない | MVPでは不要。必要になれば外部分析基盤へのexportを検討する |
| オフライン入力なし | 通信不安定時に入力できない | MVPではエラー表示と再試行を優先し、将来オフライン対応を検討する |
| 認可漏れ | 他ユーザーのデータが見えると致命的 | 全query/mutationで `userId` を必ず確認し、テストする |
| Hono追加時の複雑化 | API層が増えて責務が曖昧になる | Convexで足りない要件が出るまで追加しない |
| 環境混在 | DEVのClerkやConvexがPRODに混ざる | Clerk application、Convex deployment、環境変数を明確に分離する |

## 19. 実装前に決めたこと

- MUIは標準Material Design感を抑えた独自テーマにする
- Tailwind CSSはレイアウト用途に限定して採用する
- CSVエクスポートの生成場所は初期セットアップでは扱わず、実装時にクライアント生成を第一候補として再確認する
- オフライン入力はMVPでは扱わない
- 初期デプロイ先はVercelにする
- 独自ドメインは使わず、DEV/PRODともに `*.vercel.app` のURLを使う

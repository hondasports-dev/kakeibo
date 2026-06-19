# 週1レシート入力Web家計簿 技術設計

## 1. 設計方針

本MVPは、ClerkのGoogleアカウント認証でユーザーを識別し、Convexで家計データを保存・同期するWebアプリとして実装する。

目的は、ユーザーがPCやスマートフォンから同じ家計データへアクセスし、週1回のレシート入力と振り返りを軽快に行えることを検証することである。

Honoは初期構成には含めない。Convexはquery、mutation、action、HTTP actionを持つため、MVPの通常CRUD、同期、サーバー側処理の多くをConvex側で扱える。

## 2. 推奨技術スタック

| 領域               | 採用                                  | 理由                                                                                                      |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| フロントエンド     | Vite + React + TypeScript             | Convex Reactと相性がよく、SPAを軽く構築できるため                                                         |
| ルーティング       | React Router                          | 複数画面を明確に分けやすいため                                                                            |
| UIライブラリ       | MUI                                   | 利用実績が大きく、フォーム、テーブル、ダッシュボード系画面に強いため                                      |
| レイアウトCSS      | Tailwind CSS                          | 画面骨格、余白、レスポンシブ、表示切替を素早く実装するため。MUIコンポーネントの見た目制御には使いすぎない |
| 認証               | Clerk Google OAuth                    | Googleアカウントで素早く開始でき、Convex連携も用意されているため                                          |
| バックエンド/DB    | Convex                                | Reactから型安全にquery/mutationを呼べ、リアクティブ同期が標準で使えるため                                 |
| 入力バリデーション | Valibot                               | 軽量でTypeScriptとの相性がよく、ユーザー希望にも合うため                                                  |
| テスト             | Vitest + Testing Library + Playwright | ロジック、UI、主要フローを段階的に検証できるため                                                          |
| ホスティング       | Vercel                                | Vite SPAの配信、Preview/Production環境、MCP連携を単純に扱えるため                                         |

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
  App.tsx
  main.tsx
  router.tsx
  theme.ts
  features/                    # 機能単位（Feature-based）
    ai-expense-queue/
      components/
      hooks/
      types/
      utils/
      index.ts
    expense-entry/
      components/
      hooks/
      types/
      index.ts
    group-admin/
      components/
      utils/
      index.ts
    receipt/
      components/
      hooks/
      index.ts
    weekly-summary/
      components/
      hooks/
      types/
      index.ts
  components/                  # 複数機能で共有する UI
    AppLayout.tsx
    CategorySettingsPanel.tsx
    WeekDaySettingsPanel.tsx
    ...
  pages/
    DashboardPage.tsx
    InputPage.tsx
    SummaryPage.tsx
    SettingsPage.tsx
    NotFoundPage.tsx
  hooks/                       # ページ横断の hook（例: useGroupMembership）
  lib/
  validation/
  test/

convex/
  auth.config.ts
  schema.ts
  receipts.ts
  categories.ts
  users.ts
  weekSessions.ts
  receiptImageExtraction.ts
  aiExpenseDrafts.ts
  aiExpenseDraftsModel.ts
  http.ts
```

フロントエンドは **Feature-based Architecture** を採用する。各 feature は `src/features/<feature-name>/`
配下に置き、feature 内は **type-based**（`components/`、`hooks/`、`types/`、`utils/`）で整理する。
画面専用の `pages/`、横断的な `lib/`・`validation/`、複数 feature で使う共有 UI は `components/` に残す。

`CategoriesPage.tsx` は存在するが、現行ルーターでは `/categories` も `SettingsPage` へ向ける。

### 5.1 スタイリング責務

MUIとTailwind CSSは併用するが、責務を分ける。

| 対象         | 担当                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| MUI theme    | 色、Typography、角丸、影、コンポーネント標準スタイル                       |
| MUI `sx`     | MUIコンポーネント単位の微調整、状態依存、theme参照が必要なスタイル         |
| MUI `styled` | 再利用する独自コンポーネントや複雑なスタイル                               |
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
`tokenIdentifier` を正とする。`userId` は users と groupMembers の識別に使い、
家計データの認可は `groupId` を基準に行う。receipt、category、weekSession などの
家計データは `groupId` で絞り込み、ID指定で更新または削除する場合も、取得した
ドキュメントの `groupId` と認証ユーザーの所属グループが一致することを確認する。

`users` テーブルはClerkプロフィールのキャッシュまたはアプリ内表示名の保存が必要に
なった場合に使う。MVPの認可は `users` テーブルの存在に依存せず、
`ctx.auth.getUserIdentity()` の結果を基準に行う。

### 6.1 家族グループ公開方針

MVP時点の共有単位は家族グループとする。1ユーザーは複数グループに所属でき、現在操作
対象のグループは `users.activeGroupId` で保持する。グループ未所属のユーザーはログイン後に
グループ作成画面へ誘導し、複数グループに所属しているが activeGroupId が未設定のユーザーは
グループ選択画面へ誘導する。Clerk Allowlistは本番利用で有料機能になるため、Clerk Restricted
mode と invitation を入口制限として採用する。

- Clerk DashboardでRestricted modeを有効化する
- 家族グループのオーナーは設定画面からClerk invitationを経由してメンバーを招待する
- 招待リンクにはアプリ側の招待トークンを含め、受け入れ時に `groupMembers` へ追加する
- 誰でもGoogleログインまたはサインアップできる状態にはしない
- invitation対象メールはアプリコード、Git管理ファイル、環境変数に持たせない
- Restricted modeはアプリ入口の制限であり、Convexデータ認可の代替にはしない
- データ認可は `groupId` と `groupMembers` で行い、オーナー/メンバーの2段階権限を使う

### 6.2 認証テスト方針

Convex関数を実装する時点で、未認証の場合に拒否されること、認証済みの場合に
自分の所属グループのデータだけを扱うことをテストする。所有者チェックが必要な更新・削除は、
他グループのドキュメントIDを渡しても拒否されることを確認する。

### 6.3 グループ運用手順

管理機能 Phase1/Phase2 の境界、`owner` / `member` の権限差、危険操作の扱いは
`docs/group-admin-permissions.md` を正本とする。本節は運用フローの概要のみ記載する。

グループ所属の正本は `groupMembers` テーブルとする。Clerk invitation は
招待メール送信とサインアップ/サインイン導線に使い、誰がどのグループに所属するかは
アプリ側の `groupMembers` で管理する。

運用の流れは次のとおり。

1. オーナーが `/group/setup` で家族グループを新規作成する。
2. グループ作成時に、作成者は `groupMembers` へ `owner` として追加される。
3. オーナーは `/settings` の「グループ管理」で対象メールアドレスを入力し、Clerkを経由して招待を送る。
4. 招待リンクには `/group/invitations/accept?token=...` への戻り先を設定する。
5. 招待されたユーザーがリンクから認証を完了すると、アプリは招待トークンを検証し、
   `groupMembers` へ `member` として追加する。
6. 追加されたグループは `users.activeGroupId` に設定され、通常画面へ進める。
7. 複数グループに所属しているユーザーは `/group/select` または設定画面から表示対象グループを切り替える。
8. メンバーを外す場合は、オーナーが `/settings` からそのユーザーを削除する。
9. 削除対象ユーザーの activeGroupId が削除されたグループだった場合、残りの所属グループへ切り替える。

この運用では、次の制約を前提にする。

- 1ユーザーは同時に複数グループへ所属できる。
- `acceptGroupInvitation` は、招待メールとログイン中ユーザーのメールが一致する場合だけ所属を追加する。
- `setActiveGroup` は、ログイン中ユーザーが所属しているグループだけを active にできる。
- `removeMember` はユーザー本人の `users` レコードや Clerk アカウントは削除しない。
- 現行実装では、グループの削除やオーナー移譲は UI では提供していない。
- グループ未所属または activeGroupId 未選択のユーザーは、設定や家計データへ進めない。

## 7. 画面とルーティング

| パス                           | 画面               | 目的                                       |
| ------------------------------ | ------------------ | ------------------------------------------ |
| `/`                            | ダッシュボード     | 今週の支出、カテゴリ別支出、入力状態を確認する |
| `/weeks/current/input`         | 今週のレシート入力 | レシートを連続入力する                     |
| `/weeks/:weekStartDate`        | 週次サマリー       | 指定週の集計、支出一覧を確認する           |
| `/settings`                    | 設定               | グループ、カテゴリ、週の開始・終了曜日を設定する |
| `/categories`                  | 設定               | `/settings` と同じ設定画面への互換ルート   |
| `/group/setup`                 | グループ作成       | グループ未所属ユーザーが家族グループを作成する |
| `/group/select`                | グループ選択       | 複数所属ユーザーが表示対象グループを選ぶ     |
| `/group/invitations/accept`    | 招待受け入れ       | Clerk招待後にアプリ側の所属追加を完了する   |
| `/sso-callback`                | 認証コールバック   | Clerk SSO後のコールバックを処理する         |
| `/__e2e__/ai-expense-queue`    | E2E専用画面        | 開発時のみAI支出下書きキューを検証する     |

現行コードには `/sign-in`、`/weeks/:weekStartDate/review`、`/export` の個別ルートはない。
サインイン画面は `App.tsx` の未認証表示で扱い、振り返りメモは週次サマリー画面に埋め込む。

## 8. データ設計

### 8.1 users

| 項目                                      | 型                | 説明                                           |
| ----------------------------------------- | ----------------- | ---------------------------------------------- |
| userId                                    | string            | `UserIdentity.tokenIdentifier`                 |
| displayName                               | string            | 表示名                                         |
| email                                     | string (optional) | メールアドレス                                 |
| monthlyIncome                             | number (optional) | 月収入。現行UIからの設定導線は削除済み         |
| weeklyStartDay                            | number (optional) | 週の開始曜日（0=日曜、1=月曜）。未設定は月曜   |
| weeklyEndDay                              | number (optional) | 週の終了曜日（0=日曜、1=月曜）。未設定は日曜   |
| receiptImageExternalApiConsentAcceptedAt  | number (optional) | レシート画像を外部APIへ送信することへの承認時刻 |
| createdAt                                 | number            | 作成日時                                       |
| updatedAt                                 | number            | 更新日時                                       |

### 8.2 receipts

| 項目          | 型                | 説明                           |
| ------------- | ----------------- | ------------------------------ |
| groupId       | Id<"groups">      | 家計データの所有境界となるグループID |
| date          | string            | 入出金日。`YYYY-MM-DD`         |
| type          | `expense` / `income` (optional) | 種別。未設定は既存互換で支出扱い |
| shopName      | string (optional) | 店名。支出で使う               |
| bankName      | string (optional) | 銀行名。収入で使う             |
| amountYen     | number            | 金額。日本円の整数             |
| categoryId    | Id<"categories">  | カテゴリID                     |
| memo          | string (optional) | 任意メモ                       |
| weekStartDate | string            | 所属週の開始日。`YYYY-MM-DD`   |
| createdAt     | number            | 作成日時                       |
| updatedAt     | number            | 更新日時                       |

### 8.3 weekSessions

| 項目            | 型                    | 説明                           |
| --------------- | --------------------- | ------------------------------ |
| groupId         | Id<"groups">          | 家計データの所有境界となるグループID |
| weekStartDate   | string                | 週開始日                       |
| weekEndDate     | string                | 週終了日                       |
| reviewMemo      | string (optional)     | 振り返りメモ                   |
| status          | `draft` / `completed` | セッション状態                 |
| createdAt       | number                | 作成日時                       |
| updatedAt       | number                | 更新日時                       |

### 8.4 categories

| 項目      | 型      | 説明                           |
| --------- | ------- | ------------------------------ |
| groupId   | Id<"groups"> | 家計データの所有境界となるグループID |
| name      | string  | カテゴリ名                     |
| color     | string  | 表示色                         |
| isActive  | boolean | 新規入力で利用可能か           |
| sortOrder | number  | 表示順                         |
| createdAt | number  | 作成日時                       |
| updatedAt | number  | 更新日時                       |

### 8.5 aiExpenseDrafts

支出AI登録では、AI解析結果を既存 `receipts` に直接保存せず、未確定の下書きとして
`aiExpenseDrafts` に保存する。下書きも家計データと同じくグループ所有データであり、
`groupId` を保存する。query/mutation/action ではクライアントから渡された `userId` を
信用せず、サーバー側で取得した認証ユーザーの active group と下書きの `groupId` が一致することを確認する。

| 項目                | 型                                                                 | 説明                                  |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| groupId             | Id<"groups">                                                       | 家計データの所有境界                  |
| sourceType          | `image_upload`                                                     | 下書きの作成元                        |
| status              | `queued` / `analyzing` / `ready` / `needs_review` / `failed` / `registered` | AI処理と登録の状態                    |
| documentType        | `receipt` / `convenience_payment` / `unknown`                      | 書類種別                              |
| shopName            | string (optional)                                                  | レシート上の店名                      |
| paymentPlace        | string (optional)                                                  | 実際に支払った場所                    |
| payeeName           | string (optional)                                                  | お金の行き先                          |
| paymentPurpose      | string (optional)                                                  | 支払内容                              |
| date                | string (optional)                                                  | 支出日。`YYYY-MM-DD`                  |
| amountYen           | number (optional)                                                  | 合計金額。日本円の整数                |
| categoryId          | Id<"categories"> (optional)                                        | 登録候補カテゴリ                      |
| confidence          | object                                                             | 主要フィールドごとのAI信頼度          |
| warnings            | string[]                                                           | 解析時の警告                          |
| reviewReasons       | fixed enum array                                                   | 確認が必要な理由                      |
| registeredReceiptId | Id<"receipts"> (optional)                                          | 登録後に作成されたreceipt             |
| createdAt           | number                                                             | 作成日時                              |
| updatedAt           | number                                                             | 更新日時                              |

`reviewReasons` は文字列自由入力ではなく、UI表示と分類ロジックで扱える固定 enum とする。
初期値は `low_confidence`、`missing_required_field`、`ambiguous_document_type`、
`ambiguous_category`、`amount_mismatch`、`parse_failed` とする。

分類ロジックでは、主要フィールドの信頼度しきい値を `0.8` とする。レシート下書きは
日付、1円以上の金額、店名または支払先相当の名称、カテゴリ候補、主要フィールドの信頼度が
揃っている場合に `ready` とする。コンビニ払込票は支払先と支払内容の両方が必要であり、
不足する場合は `needs_review` として `missing_required_field` を付与する。

`unknown` の書類種別、カテゴリ未確定、AI警告、主要フィールドの低信頼度、下書き金額と明細合計の
不一致がある場合も `needs_review` とし、該当する `reviewReasons` を保存する。

### 8.6 aiExpenseDraftItems

明細行は親ドキュメントの配列にせず、`aiExpenseDraftItems` として別テーブル化する。
MVPの画面で全明細を常時表示しない場合でも、将来の複数カテゴリ登録へ安全に拡張できる
構造にする。

| 項目       | 型                          | 説明                           |
| ---------- | --------------------------- | ------------------------------ |
| groupId    | Id<"groups">                | 家計データの所有境界             |
| draftId    | Id<"aiExpenseDrafts">       | 親下書きID                     |
| itemName   | string                      | 明細名                         |
| amountYen  | number                      | 明細金額                       |
| categoryId | Id<"categories"> (optional) | 明細候補カテゴリ               |
| confidence | object                      | 明細フィールドごとのAI信頼度   |
| createdAt  | number                      | 作成日時                       |
| updatedAt  | number                      | 更新日時                       |

## 9. Convex index設計

| テーブル     | index                                     | 用途                                               |
| ------------ | ----------------------------------------- | -------------------------------------------------- |
| users        | `by_token_identifier`                     | `UserIdentity.tokenIdentifier`からユーザーを取得   |
| groupMembers | `by_user_id` | ログイン中ユーザーの所属グループ取得 |
| groupMembers | `by_group_id` | グループのメンバー一覧取得 |
| groupMembers | `by_group_id_and_user_id` | 所属重複確認・削除対象確認 |
| groupInvitations | `by_token` | 招待受け入れ時のトークン検証 |
| receipts     | `by_group_id_and_week_start_date`          | 指定グループ、指定週の支出取得                     |
| receipts     | `by_group_id_and_date`                     | 指定グループ、期間指定の支出取得                   |
| receipts     | `by_group_id_and_shop_name`                | 店名候補、カテゴリ推定                             |
| weekSessions | `by_group_id_and_week_start_date`          | 指定グループ、指定週のセッション取得               |
| categories   | `by_group_id_and_is_active_and_sort_order` | 有効カテゴリの表示                                 |
| categories   | `by_group_id_and_sort_order`               | カテゴリ設定画面、無効化済みカテゴリを含む履歴表示 |
| aiExpenseDrafts | `by_group_id_and_status_and_created_at` | 指定グループのキューを状態別・作成順で取得         |
| aiExpenseDrafts | `by_group_id_and_created_at` | 指定グループの下書き一覧を作成順で取得             |
| aiExpenseDrafts | `by_group_id_and_registered_receipt_id` | receipt登録済み下書きの参照・重複登録防止          |
| aiExpenseDraftItems | `by_group_id_and_draft_id` | 所属グループ確認済みの明細取得                     |

## 10. Convex function設計

### 10.1 receipts

- `createReceipt(input)`
- `getReceiptsByWeek(weekStartDate)`
- `getReceiptsByDate(date)`
- `updateReceipt(id, input)`
- `deleteReceipt(id)`
- `getWeekSummary(weekStartDate)`
- `getWeekSummaryWithCategories(weekStartDate)`
- `getFourWeeksSummary()`
- `getDailySpendingTrend(weekStartDate)`
- `getMonthlyExpensesSummary(month?)`
- `deleteReceiptsByUser(groupId)`（internal）

`receipts` は支出と収入の両方を扱う。支出では `shopName`、収入では `bankName` を保存し、
`type` 未設定の既存データは支出として扱う。

### 10.2 weekSessions

- `getOrCreateCurrentWeekSession()`
- `getOrCreateWeekSession(weekStartDate)`
- `getWeekSession(weekStartDate)`
- `updateReviewMemo(weekStartDate, reviewMemo)`
- `completeWeekSession(weekStartDate)`
- `resetWeekSessionForUser(groupId)`（internal）

### 10.3 categories

- `seedDefaultCategories()`
- `listActive()`
- `listForSettings()`
- `createCategory(input)`
- `updateCategory(id, input)`
- `deactivateCategory(id)`
- `deleteE2eCategoriesByUser(groupId)`（internal）

### 10.4 users

- `upsertUser()`
- `getUserProfile()`
- `getReceiptImageConsent()`
- `acceptReceiptImageExternalApiConsent()`
- `updateMonthlyIncome(monthlyIncome)`
- `updateWeeklyDays(weeklyStartDay, weeklyEndDay)`
- `clearUserMonthlyIncome(userId)`（internal）

週の開始・終了曜日は `users` に保存する。ただし現行の週計算は月曜始まり・日曜終わり固定であり、
保存値はまだ `getWeekStartDate` / `getWeekEndDate` に反映していない。

### 10.5 export

現行コードには `convex/export.ts`、CSV生成関数、`/export` 画面はない。CSVは将来の
バックアップ導線として残すが、実装済み機能として扱わない。

### 10.6 receipt image consent

- `users.getReceiptImageConsent()`
- `users.acceptReceiptImageExternalApiConsent()`

レシート画像入力PoCでは、画像を外部APIへ送信する前にユーザー単位の同意状態を確認する。同意状態は `users.receiptImageExternalApiConsentAcceptedAt` に承認時刻として保存する。

この同意は画像送信の可否判定だけに使い、receipt 保存の認可やユーザー識別には使わない。認可は従来どおり `ctx.auth.getUserIdentity()` から得た `tokenIdentifier` を基準にする。

### 10.7 AI expense drafts

- `aiExpenseDrafts.listByStatus(status)`
- `aiExpenseDrafts.getWithItems(draftId)`
- `aiExpenseDrafts.updateForReview(draftId, input)`
- `aiExpenseDrafts.registerReadyDrafts(draftIds)`
- `aiExpenseDrafts.analyzeReceiptImageToDraft(input)`
- `aiExpenseDrafts.createFromExtraction(input)`（internal）
- `aiExpenseDrafts.createFailedDraftFromImageAnalysis(input)`（internal）

下書きの作成・更新・登録処理では、必ず `ctx.auth.getUserIdentity()` と `groupMembers` から
active group を解決する。`draftId` や `categoryId` を受け取る処理では、取得したドキュメントの
`groupId` と認証ユーザーの active group が一致することを確認する。`aiExpenseDraftItems` は
`draftId` だけでなく `groupId` も保存し、明細単体の取得でもグループ境界を確認できるようにする。

`receipts` への登録時は、既存の週次集計との互換性を優先する。変換方針は次の通り。

| 下書き種別 | `receipts.shopName` 変換方針 |
| ---------- | ---------------------------- |
| `receipt` | `shopName` を使う。空の場合は `payeeName`、`paymentPlace` の順に補完する。 |
| `convenience_payment` | `payeeName` と `paymentPurpose` を連結する。空の場合は `paymentPlace`、`shopName` の順に補完する。 |
| `unknown` | 確認が必要な下書きとして扱い、登録前にユーザーが必要項目を確定する。 |

既存データへの migration / backfill は不要とする。新しい下書きテーブルの追加のみで、
既存 `receipts`、`categories`、`weekSessions` の必須項目は変更しないため、既存データの読み取りは
維持される。

## 11. Valibotバリデーション

フォーム入力とConvex mutation引数の前処理でValibotを使う。

Convexにも引数validatorがあるため、Valibotだけに依存しない。フロントではValibot、Convex functionではConvex validatorsと認可チェックを併用する。

| 対象     | ルール                       |
| -------- | ---------------------------- |
| 種別     | `expense` または `income`    |
| 店名     | 支出では空文字不可。前後の空白は除去 |
| 銀行名   | 収入では空文字不可。前後の空白は除去 |
| 金額     | 1円以上9,999,999円以下の整数 |
| カテゴリ | 有効なカテゴリIDのみ         |
| 日付     | `YYYY-MM-DD` として扱える値  |
| メモ     | 任意。500文字以下            |

## 12. 主要ロジック

### 12.1 週計算

- 週開始日は月曜日
- `getWeekStartDate(date)` で対象日の週開始日を求める
- `getWeekEndDate(weekStartDate)` で週終了日を求める
- 日付は `YYYY-MM-DD` 文字列として扱う

ユーザー設定として `weeklyStartDay` と `weeklyEndDay` は保存できるが、現行コードの週計算には
まだ反映していない。週次セッション、receipt保存時の `weekStartDate`、週次サマリーは月曜始まり・
日曜終わりで計算する。

### 12.2 集計

週次サマリーでは、対象週の `receipts` を取得して以下を算出する。

- 合計支出
- カテゴリ別合計
- レシート件数
- 前週比

集計はMVPではConvex queryで行う。

現行集計は `receipts.amountYen` を正の金額として合算する。`type: "income"` の入出金表示は
対応しているが、収入を差し引いた純支出計算にはしていない。

**週別支出推移（今週 vs 前週）:**

- `convex/receipts.ts` に `getDailySpendingTrend` query を定義する
- 今週（月曜〜日曜）と前週（同曜日範囲）の各日の支出合計を返す
- フロントでは SVG 自前描画で今週（実線）と前週（破線）の2本の折れ線を表示する
- データポイントクリック時は MUI Dialog で前週・今週の入出金リストと合計額を表示する
- 空状態: 「今週または前週の支出データがあると表示されます」

### 12.3 入力補助

- 直前入力の日付とカテゴリを次の入力の初期値に使う
- 過去の `shopName` から候補を出す
- 店名とカテゴリの過去組み合わせから、カテゴリ候補を推定する

## 13. CSVエクスポート設計

CSVは指定週または全期間の支出を対象に生成する将来拡張とする。現行コードでは `/export` 画面、
CSV生成関数、CSVダウンロード処理はいずれも未実装である。

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

## 14. レシート画像入力PoC設計

初回PoCでは、ブラウザで選択したレシート画像をクライアント側でリサイズし、Convex Action から OpenAI Vision 対応 API へ送信して `shopName` / `date` / `amountYen` の候補を返す。

### 14.1 プライバシーと保存方針

- 画像を外部APIへ送信する前に、初回同意ダイアログでユーザー確認を行う。
- 同意が保存されていない場合は、Convex Action を呼ばず、画像データも送信しない。
- 画像は Convex Storage や `receipts` テーブルへ保存しない。
- 抽出結果はフォーム候補であり、自動保存しない。
- ユーザーが `保存して次へ` を押した時点で、既存の `receipts.createReceipt` を使って通常の receipt として保存する。

### 14.2 失敗時と拒否時

- 同意拒否時は画像送信を行わず、同じレシート入力フォームで手入力に戻す。
- 抽出失敗時はエラーと手入力可能な案内を表示し、入力済みフォーム値を壊さない。
- 開発、Preview、CI では `RECEIPT_IMAGE_EXTRACTOR_MODE=mock` を使い、通常検証で実 OpenAI API を呼ばない。

## 15. ホスティング

Vite SPAはVercelで配信する。

独自ドメインは初期MVPでは使わず、Vercelが提供する `*.vercel.app` URLを使う。

DEV/PreviewはVercel Preview DeploymentのURLを使い、PRODはVercel Production DeploymentのURLを使う。

将来、独自ドメインやCloudflare Workers固有の処理が必要になった場合に、ドメイン移行やHono追加を検討する。

## 16. 環境設計

DEV / PREVIEW / PROD の3環境を分けて構築する。

| 領域           | DEV                                              | PREVIEW                                          | PROD                                              |
| -------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| フロントエンド | Vercel Preview URL、またはlocalhost              | `preview` branch の Vercel Preview              | Vercel Production URL                             |
| URL            | `https://kakeibo-*.vercel.app` などのPreview URL | `https://kakeibo-*.vercel.app` などのPreview URL | `https://kakeibo.vercel.app` などのProduction URL |
| Clerk          | Development instance                             | Development instance                             | Production instance                               |
| Clerk認証方式  | Google OAuth                                     | Google OAuth                                     | Google OAuth                                      |
| Convex         | dev deployment                                   | fixed staging deployment                         | production deployment                             |
| データ         | テストデータ                                     | 統合確認・PROD候補確認用の代表データ             | 実ユーザーデータ                                  |
| 環境変数       | `.env.local`、Vercel Preview env                 | GitHub Environment `Preview`、Vercel Preview env、Convex staging env | GitHub Environment `production`、Vercel Production env、Convex Production env |

### 16.1 環境分離方針

- DEV/PREVIEWとPRODでClerk instanceを分ける
- DEV/PREVIEW/PRODでConvex deploymentを分ける
- PREVIEWはPR単位の通常Previewと区別し、`preview` branchの統合確認とPROD候補確認として扱う
- DEVのGoogle OAuth callback URLに本番URLを入れない
- PRODのGoogle OAuth callback URLにローカルURLを入れない
- PREVIEWではClerk Development instanceを使い、Clerk Production instanceをPreview URLで使わない
- DEVデータをPRODへ手動投入しない
- PREVIEWデータをPRODへ手動投入しない
- PRODの環境変数をローカル開発に流用しない
- PROD反映は `production-release.yml` から手動承認後に実行し、Actions以外を正規ルートにしない

### 16.2 必要な環境変数

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

`CLERK_JWT_ISSUER_DOMAIN` は、DEV/PREVIEW/PRODそれぞれのClerk Frontend API URLに合わせる。

ローカルではClerk CLIとConvex CLIにより `.env.local` が生成される。`.env.local`、`.vercel/`、`.agents/`、`.pnpm-store/`、`.npmrc` はGit管理外にする。

VercelにはPreview / Productionの環境変数を分けて登録する。Production secretをローカル開発へ流用しない。

### 16.3 デプロイ方針

- PRまたは開発ブランチをDEV/PR Previewに紐づける
- `preview` branch への push は `preview-deploy.yml` からPREVIEWへ自動デプロイする
- PROD反映は `production-release.yml` から、PREVIEWで検証した同じ commit / ref をProductionへ再デプロイする
- PROD反映は GitHub Environment `production` の承認後に、Convex Production、Vercel Production、PROD smoke checklist の順で実行する
- schema変更はまずDEV Convex deploymentで確認する
- schema変更を含むリリース候補はPREVIEW Convex deploymentで代表データを使って確認する
- Clerk設定変更もまずDEVで確認する
- PROD反映前に、Googleログイン、主要CRUD、週次サマリー、設定保存を確認する

### 16.4 データ移行方針

MVPでは自動migrationを最小限にする。Convex schema変更時は、以下を確認する。

- 既存PRODデータが読めなくならないか
- 必須項目追加で既存データが壊れないか
- query/mutationの認可条件が維持されているか

## 17. テスト方針

### 17.1 Unit test

- 週開始日、週終了日の計算
- Valibot schema
- 金額バリデーション
- カテゴリ別集計
- 前週比計算
- CSV生成（将来実装時）
- CSVインジェクション対策（将来実装時）

### 17.2 Component test

- レシート入力フォーム
- カテゴリ選択
- 週次サマリー表示
- 振り返りメモ

### 17.3 Convex function test

- 未認証時にquery/mutationが拒否される
- 他グループのデータが取得・更新できない
- 初期カテゴリseed
- 週次セッション作成と再開
- レシート作成、更新、削除
- レシート画像外部API送信の同意状態取得と承認保存
- AI支出下書きの状態・確認理由・`receipts.shopName` 変換方針
- AI支出下書きと明細のグループ境界確認、登録済み下書きの重複登録防止

### 17.4 E2E test

主要フロー:

1. ClerkでGoogleログインする
2. 今週の入力を開始する
3. 支出と収入を複数件入力する
4. ダッシュボードで集計を確認する
5. 週次振り返りメモを保存する
6. 設定画面でカテゴリと週の曜日設定を確認する
7. 必要に応じてレシート画像補助やAI支出下書きキューを確認する

スマートフォン幅でも同じ主要フローが完了できることを確認する。

## 18. 実装タスク分解

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
19. レシート画像入力PoC
20. AI支出下書きキュー
21. Unit testとComponent test
22. Convex function test
23. E2E test
24. レスポンシブ確認

現行コードで未実装または未反映の項目:

- CSVエクスポート画面とCSV生成処理
- 週の開始・終了曜日設定の週計算への反映
- 月収入設定UI

旧タスクリスト上の `Unit testとComponent test` 以降は、変更内容に応じて継続的に追加・更新する。

## 19. リスクとトレードオフ

| リスク             | 内容                                | 対策                                                            |
| ------------------ | ----------------------------------- | --------------------------------------------------------------- |
| ベンダー依存       | ConvexのDB/Functionsに依存する      | データモデルを単純に保ち、CSV/JSONエクスポートを用意する        |
| SQL分析がしづらい  | Postgresほど自由なSQL分析ができない | MVPでは不要。必要になれば外部分析基盤へのexportを検討する       |
| オフライン入力なし | 通信不安定時に入力できない          | MVPではエラー表示と再試行を優先し、将来オフライン対応を検討する |
| 認可漏れ           | 他グループのデータが見えると致命的  | 全query/mutationで `groupMembers` と `groupId` を必ず確認し、テストする |
| Hono追加時の複雑化 | API層が増えて責務が曖昧になる       | Convexで足りない要件が出るまで追加しない                        |
| 環境混在           | DEVのClerkやConvexがPRODに混ざる    | Clerk application、Convex deployment、環境変数を明確に分離する  |

## 20. 実装前に決めたこと

- MUIは標準Material Design感を抑えた独自テーマにする
- Tailwind CSSはレイアウト用途に限定して採用する
- CSVエクスポートは現行コードでは未実装であり、実装時にクライアント生成またはConvex側生成を再確認する
- オフライン入力はMVPでは扱わない
- 初期デプロイ先はVercelにする
- 独自ドメインは使わず、DEV/PRODともに `*.vercel.app` のURLを使う

## 21. M18. 支出項目モデル再設計

M18では、週1回まとめ入力する既存MVP利用者向けに、家計簿の中心を `receipts` から `expenseEntries` に寄せ、レシートや払込票などの入力元を `sourceDocuments` として分離する。`inputSources` は説明用の言い換えとして扱う。

### 21.1 用語の役割

- `sourceDocuments`
  - schema 上の正本名とする
  - レシート、払込票、手入力、AI下書きなどの入力元を表す
  - いつ、どの経路で、何から入力したかを保持する
- `inputSources`
  - 説明文やUIで使う言い換えとして扱う
  - 意味は `sourceDocuments` と同じ
- `expenseEntries`
  - カテゴリ別支出項目を表す
  - 週次集計、カテゴリ別集計、振り返りの正本になる
  - 1つの入力元から複数件の支出項目を作れる前提を持つ

### 21.2 互換と移行

- `receipts` は当面の互換層として残す
- 既存の表示や集計は、M18の子Issueで段階的に `expenseEntries` 中心へ寄せる
- このIssueでは schema の実装変更は行わず、用語、責務、実装順を確定する
- 移行期間の集計は `expenseEntries` を優先し、同じ日付に `expenseEntries` がある場合は
  同日の `receipts` を集計対象から外して二重計上を防ぐ
- `expenseEntries` がまだ存在しない日付は `receipts` を従来どおり集計する

### 21.3 M18の実装順

1. #177 `sourceDocuments` / `expenseEntries` の schema 設計
2. #180 既存 `receipts` との互換・移行方針
3. #178 カテゴリ別集計の `expenseEntries` 化
4. #181 入力元から複数のカテゴリ別支出項目を作るUI
5. #173 レシート画像認識時のカテゴリ自動判定
6. #179 AI下書きからカテゴリ別支出項目候補を作成
7. #175 登録済みカード表示改善
8. #102 受け入れ確認

### 21.4 主要 mutation / query 方針

- `sourceDocuments` は入力元の正本として CRUD する。
- `expenseEntries` は家計簿集計の正本として CRUD する。
- 手入力では `sourceDocumentId` なしの `expenseEntries` を許容する。
- 1つの `sourceDocuments` から 0 件以上の `expenseEntries` を作れるようにする。
- 既存 `receipts` の query / mutation は当面の互換層として残し、後続 Issue で `expenseEntries` 中心に移行する。
- 所有境界は `ctx.auth.getUserIdentity()`、`groupMembers`、`users.activeGroupId` から解決した `groupId` を基準に統一する。

### 21.5 schema 案

#### sourceDocuments

入力元の原本を表す。手入力・レシート・払込票・AI 下書きの共通入口にする。

- `groupId`: `Id<"groups">`
- `sourceType`: `manual` / `receipt` / `convenience_payment` / `invoice` / `unknown`
- `status`: `draft` / `ready` / `finalized`
- `date`: `string` optional
- `totalAmount`: `number` optional
- `shopName`: `string` optional
- `paymentPlace`: `string` optional
- `payeeName`: `string` optional
- `paymentPurpose`: `string` optional
- `imageStorageId`: `Id<"_storage">` optional
- `aiExtraction`: object optional
- `createdAt`: `number`
- `updatedAt`: `number`

#### expenseEntries

カテゴリ別支出項目を表す。週次集計・カテゴリ集計・一覧表示の正本にする。

- `groupId`: `Id<"groups">`
- `sourceDocumentId`: `Id<"sourceDocuments">` optional
- `date`: `string`
- `amount`: `number`
- `categoryId`: `Id<"categories">`
- `title`: `string`
- `memo`: `string` optional
- `entryType`: `expense` / `income`
- `source`: `manual` / `ai_suggested` / `imported`
- `createdAt`: `number`
- `updatedAt`: `number`

#### `sourceDocumentId` の扱い

- 手入力で支出項目だけ作る場合は `sourceDocumentId` を入れない。
- 画像・払込票・AI 下書き由来の項目は、対応する `sourceDocuments` がある場合のみ `sourceDocumentId` を入れる。
- 1つの `sourceDocuments` に対して `expenseEntries` が 0 件のまま残るのは、下書き保存または一時保留として許容する。
- `sourceDocuments.status = finalized` は、少なくとも 1 件の `expenseEntries` が紐付いた状態を基本とする。

### 21.6 index 案

- `sourceDocuments`
  - `by_group_id_and_status_and_created_at`
  - `by_group_id_and_date`
- `expenseEntries`
  - `by_group_id_and_date`
  - `by_group_id_and_category_id_and_date`
  - `by_group_id_and_source_document_id`

### 21.7 互換境界

- #177 では `receipts` を書き換えない。
- #177 では `expenseEntries` の保存責務だけを定義し、既存 `receipts` の読み書き互換は #180 に集約する。
- これにより、M18 の後続 Issue は `expenseEntries` を正本として扱える。

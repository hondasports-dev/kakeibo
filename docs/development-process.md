# 開発プロセス

このドキュメントは、kakeibo プロジェクトの開発プロセスを定義します。

運用は意図的に軽量にします。開発速度を保ちながら、`main` は保護され、
常にビルド可能な状態を維持します。

## 目的

- `main` をビルド可能で、必要なときにデプロイできる状態に保つ。
- 変更を Pull Request でレビュー可能にする。
- チームが継続して守れる軽量なプロセスにする。
- Convex、Clerk、認可に関わる変更の影響をマージ前に明確にする。

## ブランチ運用

- `main` は保護対象のデフォルトブランチとする。
- 作業ブランチは最新の `main` から作成する。
- `main` へ直接 push しない。
- ブランチ名は読みやすければよく、厳密な命名規則は設けない。

推奨例:

- `feature/add-budget-summary`
- `fix/transaction-form-validation`
- `chore/update-dependencies`
- `docs/development-process`

## Issue 運用

次の変更は、実装作業に入る前に Issue を作成します。調査は Issue 作成前に
行ってもかまいません。

- 機能追加
- バグ修正
- 設計またはアーキテクチャ変更
- Convex の schema、index、auth、migration に関わる変更
- ユーザー影響またはデータ影響が不明確な変更

次のような小さく低リスクな変更では、Issue 作成は任意です。

- typo 修正
- ドキュメントのみの更新
- 振る舞いを変えない小さなリファクタリング
- runtime の振る舞いを変えない低リスクな依存関係更新
- 小さな設定整理

Issue には次の内容を書きます。

- 目的
- 背景または問題
- 期待する結果
- 完了条件

runtime 依存関係の更新では、Issue が不要な場合でも Pull Request に確認内容を
記載します。

## Pull Request 運用

`main` への変更は、必ず Pull Request を経由します。

Pull Request には次の内容を書きます。

- 変更の目的
- 変更内容の概要
- 確認方法
- 関連 Issue がある場合はそのリンク
- UI 変更がある場合は、必要に応じてスクリーンショット
- 関連する場合は Convex/Auth への影響

Pull Request は短時間でレビューできる大きさに保ちます。目安として、可能な限り
差分は 300 行以内にします。500 行を超える場合は、分割するか、1つの Pull Request
にまとめる理由を書きます。

設計相談が必要な変更や大きめの変更では、早めに Draft Pull Request を作成します。

## レビュー方針

原則として、マージ前に 1 approval を必須とします。

次の条件をすべて満たす小さく低リスクな変更は、自己マージしてもかまいません。

- ドキュメント、typo、formatting、小さな設定修正である。
- CI が通っている。
- Convex、Clerk、認可、データ構造、デプロイ挙動に影響しない。

ただし、`convex/`、`.github/`、`CODEOWNERS` 配下の変更は、小さな変更であっても
自己マージしません。

レビューでは次の観点を確認します。

- 正しさ
- ユーザー影響
- データ影響
- セキュリティと認可
- 保守性
- テストまたは確認不足
- 既存コードのパターンとの一貫性

レビューコメントでは、懸念の理由を書きます。可能であれば、具体的な代替案も
提示します。

## CODEOWNERS

CODEOWNERS は最小構成から始めます。最初の保護対象は次の範囲です。

- `convex/`
- `.github/`

これらの範囲の変更は、マージ前に Tech Lead または owner のレビューを受けます。

CODEOWNERS の範囲は、責任範囲が明確になってから拡大します。

このドキュメントでの owner は、変更対象の範囲について CODEOWNERS に記載された
担当者を指します。owner が定義されていない場合は、Tech Lead を owner とします。

## CI とマージ条件

必須チェックは次の3つです。

- `pnpm run lint`
- `pnpm run build`
- `pnpm test --run`

### 現状の検証コマンド

| コマンド | CI 必須 | 詳細 |
|---|---|---|
| `pnpm run lint` | ✅ 必須 | ESLintによるTypeScript/React hooksチェック |
| `pnpm run build` | ✅ 必須 | tsc -b + vite build。チャンクサイズ警告あり（許容） |
| `pnpm test --run` | ✅ 必須 | vitest（92テスト）。convex/ の純粋関数と src/validation/ を対象 |
| `pnpm run e2e:smoke --project=chromium` | ✅ 必須（CI） | Playwright Chromium smoke。Vercel Preview に対して自動実行 |

**注意事項:**
- `build` のチャンクサイズ警告は Material-UI 全体がバンドルされているため。exit code は 0 のため許容
- フロントエンドのコンポーネントテスト（Testing Library等）は将来の拡張とする

必須 CI が失敗している状態ではマージしません。flaky なチェックや環境要因でブロック
されている場合は、Issue を作成またはリンクし、理由を記録してから判断します。

推奨する `main` ruleset:

- Pull Request 経由のマージを必須にする。
- 1 approval 以上を必須にする。
- required status checks の成功を必須にする。
- conversation resolution を必須にする。
- force push を禁止する。
- 保護対象の `main` ブランチ削除を禁止する。

## E2E 確認方針

Pull Request ごとに Vercel Preview に対して GitHub Actions で Playwright smoke E2E を実行します。
実装は `.github/workflows/e2e.yml` を参照してください。

### 基本方針

- Vercel Git Integration が作成した Preview Deployment の URL を対象にします。
- smoke E2E は GitHub Actions 上で実行し、QA Agent は結果確認と失敗内容の要約のみを担当します。
- QA Agent に `VERCEL_AUTOMATION_BYPASS_SECRET` などの秘匿情報を渡しません。
- Vercel Authentication 付き Preview へのアクセスには、Vercel の
  Protection Bypass for Automation を使います。
- `VERCEL_AUTOMATION_BYPASS_SECRET` は GitHub Actions Secrets にのみ保存し、ログ、
  Pull Request コメント、チャット、ローカルファイルには出力しません。
- fork など信頼できない Pull Request では、Secrets を渡す E2E は実行しません。
- workflow は deployment の発生元が同一リポジトリの PR または branch であることを確認し、
  判定できない場合は Secrets 付き E2E を実行しません。
- Playwright の trace、HAR、スクリーンショット、artifact には認証情報や cookie が
  含まれる可能性があるため、保存期間を短くし、必要最小限だけ保存します。

### ローカル E2E 実行

`.env.local` に E2E 用環境変数が設定済みの場合、ローカルでも smoke E2E を実行できます。
E2E_BASE_URL が未設定のとき `playwright.config.ts` が `pnpm run dev` を自動起動します。

```bash
pnpm run e2e:smoke --project=chromium
```

E2E 用環境変数が未設定の場合はスキップしてよく、その場合は CI の E2E 結果に委ねます。

### E2E テスト設計基準（issue-delivery QA Agent 向け）

- Product Lead の完了条件と Tech Lead のテスト方針を照合する。
- 既存テストでカバーできる場合は、新規 E2E を増やさず `e2e/` の該当ファイルを参照する。
- 新規シナリオが必要な場合は、優先度（P0/P1/P2）、カテゴリ、Given / When / Then、テストデータ・cleanup 要否を決める。
- E2E は、ユーザー価値に直結する主要導線、認証・権限、データ保存、重大な回帰リスクを優先する。
- 細かいバリデーション分岐や境界値の大半は、単体テストまたは統合テストで確認する。
- QA Agent に Secret 値を渡さない。必要な場合は GitHub Actions Secrets に設定済みであることだけを前提条件にする。

### 実行環境

- ブラウザ: Chromium
- CI: GitHub Actions（ubuntu-latest）、`.github/workflows/e2e.yml`
- ローカル: `http://localhost:5173`（`pnpm run dev` 自動起動）
- Vercel Preview: `deployment_status` イベントで smoke E2E を自動トリガー
- 失敗時のみ trace / screenshot を保存（retention: 1 日）

## Codex 開発時の Clerk 認証

Codex で画面確認や将来の E2E を行う場合は、Clerk Development instance 上の
テスト専用ユーザーを使います。本番 instance、本番キー、個人ユーザーは使いません。

初回セットアップ:

```bash
pnpm exec clerk auth login
pnpm exec clerk link
pnpm exec clerk env pull --instance dev --file .env.local
```

`.env.local` に Codex/E2E 用ユーザー情報を追加します。パスワードはローカル専用で
生成し、ログ、Pull Request、チャットに出力してはいけません。

```env
E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
E2E_CLERK_USER_PASSWORD=...
```

テストユーザーを作成します。

```bash
pnpm exec clerk users create \
  --instance dev \
  --email "$E2E_CLERK_USER_EMAIL" \
  --password "$E2E_CLERK_USER_PASSWORD" \
  --first-name Codex \
  --last-name Test \
  --yes
```

`.env.local` に必要な値:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
E2E_CLERK_USER_EMAIL=codex+clerk_test@example.com
E2E_CLERK_USER_PASSWORD=...
VITE_CONVEX_URL=https://...
```

ローカルで Google OAuth を確認する場合、フロントエンドは
`VITE_CLERK_PUBLISHABLE_KEY` を必須とします。未設定のまま起動すると、アプリは
明示的なエラーで停止します。

Google OAuth の確認には、実在する Google アカウントを使います。
`codex+clerk_test@example.com` のような Clerk 開発用テストユーザーは
Clerk のメール/パスワード認証や E2E 補助用であり、Google OAuth のログインには
使えません。Google の認証画面で存在しない Google アカウントを入力すると、
Google 側でエラーになります。

このアプリの OAuth callback は `/sso-callback` です。Vite dev server の標準ポートを
使う場合、ローカルの callback URL は `http://localhost:5173/sso-callback`、
ログイン完了後の戻り先は `http://localhost:5173/` です。ポートを変える場合は、
同じパスで origin だけを実際の dev server に合わせます。

Clerk Dashboard の Development instance では次を確認します。

- Google social connection を有効にする。
- Sign-in と Sign-up の両方で Google を利用できる状態にする。
- redirect URL や allowed origin を制限している場合は、ローカルの
  `http://localhost:5173` と `http://localhost:5173/sso-callback` を許可する。
- 独自の Google OAuth credentials を使う場合は、Google Cloud Console に
  Clerk Dashboard が表示する Google 接続用 callback URL を登録する。ローカルの
  `/sso-callback` は Clerk からアプリへ戻るための URL であり、Google Cloud 側の
  redirect URI ではありません。

Convex backend が Clerk JWT を検証するため、Clerk の Frontend API URL を
Convex dev deployment に設定します。これは `.env.local` だけでは反映されません。

```bash
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN 'https://xxxx.clerk.accounts.dev'
pnpm run convex:dev
```

Playwright E2E では `@clerk/testing` の `setupClerkTestingToken` を使い、
`E2E_CLERK_USER_EMAIL` のユーザーとして認証します。これにより、毎回 Clerk UI を
操作せずに、Clerk と Convex の実際の認証経路を通して確認できます。
詳細は `e2e/helpers/` および `e2e/global-setup.ts` を参照してください。

## Definition of Done

変更は、関連する次の項目を満たしたときに完了とします。

- 要求された振る舞いが実装されている。
- 必須 CI が通っている。
- Pull Request に影響範囲と確認内容が書かれている。
- 意味のある品質担保になる場合は、テストが追加または更新されている。
- 自動テストだけでは不足する場合は、手動確認が行われている。
- UI 変更では、必要に応じてスクリーンショットが添付されている。
- Convex、Clerk、認可への影響が確認されている。
- 必要なドキュメントが更新されている。

## Convex 変更

Convex コードを編集する前に、次のファイルを確認します。

- `convex/_generated/ai/guidelines.md`

Convex に関わる Pull Request では、PR 本文に次の内容を書きます。

- schema 変更の有無
- index 変更の有無
- 既存データへの影響
- migration または backfill の要否
- Clerk/auth または認可挙動への影響
- 確認方法

Convex の schema、index、migration、backfill、auth、権限に関わる変更は、マージ前に
Tech Lead または owner のレビューを受けます。

## Hotfix

Hotfix も Pull Request を経由します。

緊急の本番修正では、次の運用を許可します。

- Issue 作成は修正後でもよい。
- Pull Request の差分はできるだけ小さくする。
- 必須 CI を実行する。
- レビュー後、速やかにマージする。
- マージ後、原因、影響、再発防止の follow-up を Issue または Pull Request に記録する。

緊急 hotfix 時に、必須 CI が無関係な環境要因でブロックされている場合のみ、
Tech Lead はリスク、手動確認内容、follow-up Issue を記録したうえでマージを承認できます。

Hotfix を通常のレビュー回避手段として使ってはいけません。

## Project 管理

初期段階では、厳密な GitHub Projects 運用は必須にしません。

まずは Issue と Pull Request を作業の source of truth とします。複数の作業を横断して
計画する必要が出てきたら、GitHub Project を導入します。

Project を導入する場合は、次のシンプルな status flow から始めます。

- Backlog
- Ready
- In Progress
- In Review
- Done

## Labels

label は最小構成から始めます。

- `bug`
- `feature`
- `chore`
- `docs`

新しい label は、実際にフィルタリングやトリアージの課題を解決するときだけ追加します。

## 将来見直す項目

プロセスを一定期間運用した後、次の項目を見直します。

- `pnpm run test` を必須 CI にする。
- CODEOWNERS の範囲を `convex/` と `.github/` 以外にも広げる。
- 計画管理に GitHub Projects を導入する。
- coverage 閾値を設定する。
- リリースノートまたは tag ベースのリリース運用を定義する。
- 大きなアーキテクチャ判断に ADR を導入する。
- Convex migration/backfill ルールを専用ドキュメントに分離する。

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
- コード変更を含む作業ブランチは、ローカルの `main` を最新化してから原則 `git worktree` で作成する。
- `main` へ直接 push しない。
- ブランチ名は読みやすければよく、厳密な命名規則は設けない。

作業開始時は、通常の checkout で `main` を最新化します。

```bash
git checkout main
git pull
```

その後、コード変更を含む作業ブランチは `git switch -c` ではなく `git worktree add` で作成し、
作業ごとのディレクトリを分けます。

```bash
git worktree add ../kakeibo-worktrees/<branch-name> -b <branch-name>
cd ../kakeibo-worktrees/<branch-name>
```

`git worktree` の配置先は、リポジトリに誤って含まれない場所を使います。
リポジトリ配下に配置する場合は、事前に `.gitignore` で除外されていることを確認します。
`issue-tdd-run` / `issue-tdd-workflow` や Implementer ロールで作業ブランチを作成する場合も、
この `git worktree` 手順に従います。ただし、ドキュメントのみの改善、マージ後の
`main` 最新化、またはユーザーが既存PRへ混ぜるよう明示した修正では、新しい
`git worktree` を機械的に作成しません。

推奨例:

- `feature/add-budget-summary`
- `fix/transaction-form-validation`
- `chore/update-dependencies`
- `docs/development-process`

## ローカル Git フック

このリポジトリでは、コミット前に `lint-staged` を使って `oxlint` と `oxfmt --check` を
自動実行します。`package.json` の `prepare: "husky"` と `.husky/pre-commit` がその入口です。
`oxfmt` の ignore 設定で Markdown は対象外のため、Markdown の整形確認は `git diff --check`
や目視確認で補います。

### 確認手順

新しい worktree を作った直後や、フックの動作が怪しいときは次を確認します。

1. `pnpm install` を実行して `husky` の初期化を行う。
2. `git config --get core.hooksPath` が `.husky/_` になっていることを確認する。
3. `.husky/_` 配下に hook ランチャーが生成されていることを確認する。
4. ステージした変更に対して `pre-commit` フックが動くことを、実際の commit か `git commit --dry-run` で確認する。
5. Markdown を含む変更では `git diff --check` も実行し、改行や空白の崩れがないことを確認する。

このフローが壊れている場合は、`pnpm exec husky` で初期化を再実行するか、`pnpm install` をやり直します。

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

### Issue タスク台帳

`issue-tdd-run` / `issue-tdd-workflow` で Issue を処理する場合、Issue は人間と Codex / Devin の
共通の作業台帳として扱います。作業開始時に Issue 本文へタスクリストを追加できる場合は
本文を更新し、本文更新ができない場合は「Issue Delivery タスク台帳」コメントを投稿します。
ただし、一時作業メモとして `e2e-test-case.md`、`implementation-plan.md`、
`delivery-notes.md` のようなファイルは作りません。検討内容は Issue コメント、
PR本文、または既存docsへ集約します。
特に `docs/superpowers/` 配下へ設計書や実装計画を作成することは禁止します。

台帳には少なくとも次を含めます。

- Product Lead 要件確認
- Tech Lead 仕様確定
- QA Agent E2E テスト設計レビュー
- TDD 実装タスク
- コードレビュー対応
- ローカル検証
- GitHub Actions / E2E 結果確認
- PR マージと完了報告

各フェーズの開始・完了・差し戻しは Issue コメントに残します。差し戻しが発生した場合も
作業を止めず、タスク台帳を更新して該当フェーズへ戻ります。これにより、途中から人間が
確認しても、エージェントが再開しても、現在位置と未完了タスクを Issue から追跡できます。

### Issue の要件確認（プロダクトリード3エージェント並列評価）

`issue-tdd-run` で Issue を処理する場合、フェーズ0（`issue-gate-0`）では
**3人のプロダクトリードサブエージェントを並列で起動**して要件を評価します。
Codexでサブエージェント機能が未ロードの場合は、`tool_search` で multi-agent / spawn 系ツールを探し、
`multi_agent_v1.spawn_agent` が使える場合は次の固定名をプロンプトに含めて起動します。

| エージェント | 担当観点                                 |
| ------------ | ---------------------------------------- |
| プロダクトリードA サブエージェント | ユーザー価値・解く課題・ペルソナ |
| プロダクトリードB サブエージェント | 最小スコープ・スコープ肥大化検出 |
| プロダクトリードC サブエージェント | 完了条件の検証可能性・受け入れ基準の粒度 |

3エージェントの評価を統合して `approved` / `needs_discussion` の最終判定を出します。
詳細なテンプレートと統合ルールは `.agents/roles/01-product-lead.md` を参照してください。

UI/UXを変更するIssueでは、Product Leadとの要件定義フェーズで
**UX/UIデザイナー サブエージェントも起動**し、Product Lead 3エージェントの評価と
並行して議論させます。

UI/UX変更に含める範囲:

- 画面構成、ナビゲーション、ユーザーフローの変更
- 入力フォーム、主要操作、情報設計、状態表示の変更
- レスポンシブ、空状態、エラー状態、ローディング状態の変更
- 見た目の調整であっても、操作効率や可読性に影響する変更

Optional UX/UI Designer は `.agents/roles/optional-ux-ui-designer.md` と
`docs/ui-ux-design.md` を参照し、次の観点を確認します。

- Product Lead の要件が、既存のUI/UX方針と矛盾しないか
- ユーザーフロー、画面構成、UI状態に抜けがないか
- 実装前に具体化すべきUX上の曖昧さがないか
- Tech Lead と QA Agent に渡すべきUI/UX上の注意点

Designer がUX上の曖昧さ、既存方針との矛盾、または検証不能なUI完了条件を指摘した場合、
最終判定は `needs_discussion` とし、ユーザー確認または要件の具体化を行ってから
フェーズ1（Tech Lead）へ進みます。

### Issue への要件定義結果・議論の記録

要件定義フェーズ（Product Lead によるレビュー、UX/UI Designer との議論、ユーザーとの確認）で
決まった内容や変更になった判断は、**まとまった単位で Issue にコメントとして記録**します。

記録するタイミングと内容:

| タイミング                          | 記録する内容                                                           |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Product Lead 評価完了時             | 3エージェントの評価サマリーと `approved` / `needs_discussion` の判定   |
| UX/UI Designer レビュー完了時       | 指摘事項、方針との整合性確認結果、Tech Lead に渡す注意点               |
| `needs_discussion` → 再確認完了時   | ユーザーとの合意内容、変更になったスコープや完了条件                   |
| Tech Lead 設計完了時（フェーズ1）   | 採用アーキテクチャ、見送った代替案とその理由、実装方針の決定内容       |
| 実装中に設計を変更した場合          | 変更した判断内容と理由（実装コメントではなく Issue へ）                |

記録の粒度:

- **細かすぎる作業ログは不要**。決定事項、変更になった判断、後から見返す価値のある情報を書く。
- 1 つの議論フェーズが一区切りついたら、その結論をまとめて 1 コメントとして投稿する。
- 「なぜその実装にしたか」「代替案を何故採用しなかったか」は Issue に残す価値が高い。

これにより、Issue を読むだけで要件定義から実装決定までの判断履歴を追跡できるようにします。

## Pull Request 運用

`main` への変更は、必ず Pull Request を経由します。

Pull Request には次の内容を書きます。

- 変更の目的
- 変更内容の概要
- 確認方法
- 関連 Issue がある場合はそのリンク
- UI 変更がある場合は、必要に応じてスクリーンショット
- 関連する場合は Convex/Auth への影響
- 追加または更新したテスト、E2Eを追加しない場合はその理由

`issue-tdd-workflow` で作成する Pull Request では、PR 本文または PR コメントに
終了条件タスクを置きます。PR はこのタスクがすべて完了してからマージします。

終了条件タスク:

- [ ] 関連 Issue がリンクされている
- [ ] 要件定義結果が Issue に記録されている
- [ ] 実装タスクがすべて完了している
- [ ] TDD のテスト追加または更新が含まれている
- [ ] `pnpm test --run` がローカルで成功している
- [ ] `pnpm run lint` がローカルで成功している
- [ ] `pnpm run build` がローカルで成功している
- [ ] `pnpm run e2e -- --project=chromium` がローカルで成功している
- [ ] GitHub Actions の全チェックが成功している
- [ ] Reviewer の指摘がすべて解決済み
- [ ] QA Agent の E2E 結果確認が `success`
- [ ] 未解決の conversation がない
- [ ] マージ後の Issue 完了報告内容が準備済み

Markdown のみを変更する Pull Request では、ローカル検証と GitHub Actions / E2E の
終了条件を `git diff --check` などの Markdown 差分確認に置き換えてよいです。

Pull Request は短時間でレビューできる大きさに保ちます。目安として、可能な限り
差分は 300 行以内にします。500 行を超える場合は、分割するか、1つの Pull Request
にまとめる理由を書きます。

設計相談が必要な変更や大きめの変更では、早めに Draft Pull Request を作成します。

## レビュー方針

原則として、マージ前に 1 approval を必須とします。

次の条件をすべて満たす小さく低リスクな変更は、自己マージしてもかまいません。

- ドキュメント、typo、formatting、小さな設定修正である。
- CI が通っている、または Markdown のみの変更で CI 対象外である。
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

Pull Request に付いたレビュー指摘は、マージ前にすべて対応します。対応とは、
指摘内容を反映して修正すること、または修正しない理由を明記して reviewer と合意することを
指します。未対応の指摘や未解決の conversation が残っている状態ではマージしません。

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

Markdown のみを変更する Pull Request / push では、GitHub Actions の CI を実行しません。
`.github/workflows/ci.yml` は `**/*.md` のみの変更を `paths-ignore` で除外します。
Vercel Preview 由来の E2E も、関連 Pull Request の変更ファイルが Markdown のみなら
E2E 本体へ進みません。

### 現状の検証コマンド

| コマンド                                | CI 必須       | 詳細                                                       |
| --------------------------------------- | ------------- | ---------------------------------------------------------- |
| `pnpm run lint`                         | ✅ 必須       | ESLintによるTypeScript/React hooksチェック                 |
| `pnpm run build`                        | ✅ 必須       | tsc -b + vite build。チャンクサイズ警告あり（許容）        |
| `pnpm test --run`                       | ✅ 必須       | vitest。convex/ の純粋関数と `src/features/**/validation/` 等を対象 |
| `pnpm run e2e:smoke -- --project=chromium` | ✅ 必須（CI） | Playwright Chromium smoke。Vercel Preview に対して自動実行 |

**注意事項:**

- `build` のチャンクサイズ警告は Material-UI 全体がバンドルされているため。exit code は 0 のため許容
- フロントエンドのコンポーネントテスト（Testing Library等）は M2 以降に別 Issue を立てて対応する

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

`preview` ブランチのデプロイでは、`.github/workflows/preview-deploy.yml` が
Vercel Preview URL に対して Playwright smoke E2E を実行します。
Vercel Git Integration 由来の Preview Deployment に対する補助的な E2E は
`.github/workflows/e2e.yml` を参照してください。

### 基本方針

- `preview-deploy.yml` では、Vercel CLI が作成した Preview Deployment の URL を対象にします。
- `e2e.yml` は `deployment_status.target_url` が `.vercel.app` の場合だけ実行し、
  GitHub Environment の deployment_status など、アプリではないURLは対象にしません。
- `preview` ブランチ由来の Preview Deployment は `preview-deploy.yml` 内で smoke E2E を実行するため、
  `e2e.yml` の単独 E2E では対象にしません。
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
pnpm run e2e:smoke -- --project=chromium
```

E2E 用環境変数が未設定の場合はスキップしてよく、その場合は CI の E2E 結果に委ねます。

`issue-tdd-workflow` で PR マージまで全自動運用する場合は、ローカル E2E を CI 任せに
しません。PR 作成前および差し戻し修正後に、ローカルで必要な E2E を完走します。
広い導線や認証・データ保存に触る変更では全 E2E を実行し、変更が限定的なら
該当 spec または smoke E2E に絞ってよいです。

```bash
pnpm run e2e -- --project=chromium
```

環境変数不足、Clerk/Convex/Vercel の一時的な問題などでローカル E2E が実行不能な場合は、
先へ進まず、Issue と PR に実行不能理由、必要な設定、再実行条件を記録して判断します。
GitHub Actions についても、E2E だけでなく全チェックが完了し、すべて `success` になってから
PR をマージします。

ただし Markdown のみの変更では、GitHub Actions / E2E の成功確認は不要です。

## preview ブランチ / PREVIEW 運用

開発統合は `preview` ブランチで行います。`preview` に merge された変更は、
GitHub Actions から固定 Convex staging deployment と Vercel Preview へ反映します。
`main` への merge は本番反映ではなく、PROD リリース候補の確定として扱います。

```text
feature/*
  ↓
previewへmerge
  ↓
preview-deploy.yml が Convex staging → Vercel Preview の順で反映
  ↓
PREVIEW URLで動作確認
  ↓
mainへmerge
  ↓
production-release.yml でPROD反映
```

`preview` ブランチの通常デプロイは、`preview-deploy.yml` が `push` を契機に自動実行します。
この workflow は GitHub Environment `Preview` の secret / variable を使い、
固定 Convex staging deployment と Vercel Preview deployment を作成します。

PROD 反映は `main` への push で `production-release.yml` が自動起動します。PREVIEW で確認した内容を
`main` へ merge し、preflight の成功後に GitHub Environment `production` の承認を待ちます。
承認後は Convex Production、Vercel Production、PROD smoke checklist の順で実行します。
Actions 以外の Vercel Dashboard、Convex Dashboard、ローカル CLI からの直接 Production deploy は
正規ルートにしません。

手動リリースや forward-fix で `production-release.yml` を手動実行する場合の入力は次の方針にします。

| 入力 | 例 | 方針 |
| --- | --- | --- |
| `source_ref` | `main` | PREVIEW で検証済みの `main` または `release/*` |
| `preview_confirmed` | `true` | 同じ ref の PREVIEW 確認が完了していること |
| `db_schema_change_check` | `no_db_or_schema_change` | DB/schema 変更なし、または forward-fix 前提の確認済みを選ぶ |
| `release_note` | `m15 PREVIEW URL確認済み` | PREVIEW evidence またはリリース意図 |

GitHub Environment `production` では Required reviewers、Prevent self-review、Deployment branch rule を有効にします。
Production 用 secret / variable は `production` environment にだけ置き、DEV / PREVIEW へ流用しません。

PROD smoke は初期運用では非破壊確認に限定します。workflow は Vercel Production deployment URL または
`PRODUCTION_SMOKE_URL` へ HTTP GET を行い、空でない応答を確認します。データ作成、更新、削除を伴う確認は
自動 smoke では行わず、必要最小限の手動確認として扱います。

### E2E テスト設計基準（issue-gate-0 / QA Agent 向け）

- Product Lead の完了条件と Tech Lead のテスト方針を照合する。
- 既存テストでカバーできる場合は、新規 E2E を増やさず `e2e/` の該当ファイルを参照する。
- 新規シナリオが必要な場合は、優先度（P0/P1/P2）、カテゴリ、Given / When / Then、テストデータ・cleanup 要否を決める。
- テストケース判断のためだけに `e2e-test-case.md` のような一時ファイルを作らない。要件、コード、既存テストを読んで判断する。
- 追加・変更したシナリオは、該当する `e2e/*.spec.ts` やコンポーネントテスト内のテスト名・コメントを正本として記録する。
- E2E は、ユーザー価値に直結する主要導線、認証・権限、データ保存、重大な回帰リスクを優先する。
- 細かいバリデーション分岐や境界値の大半は、単体テストまたは統合テストで確認する。
- QA Agent に Secret 値を渡さない。必要な場合は GitHub Actions Secrets に設定済みであることだけを前提条件にする。

### 実行環境

- ブラウザ: Chromium
- CI: GitHub Actions（ubuntu-latest）、`.github/workflows/preview-deploy.yml` と `.github/workflows/e2e.yml`
- ローカル: `http://localhost:5173`（`pnpm run dev` 自動起動）
- Vercel Preview: `preview` ブランチは `preview-deploy.yml` 内で smoke E2E を実行し、
  PR Preview などの補助的な `.vercel.app` `deployment_status` は `e2e.yml` の対象にする
- 失敗時のみ trace / screenshot を保存（retention: 1 日）

### Vercel Preview と Convex subscription の挙動差異（重要）

**Vercel Preview（本番ビルド）は、ローカル Vite dev より Convex subscription の
更新反映が遅い。** この差異を考慮せずに E2E を書くと、ローカルでは通るが CI
（Vercel Preview 対象）では flaky になる。

**NG パターン（避ける）**

```ts
// mutation 後にダイアログを閉じてから subscription の更新を確認しようとする
await page.keyboard.press('Escape'); // ← ダイアログを閉じる
await expect(残金カード).toHaveText('...'); // ← この時点では更新が間に合わないことがある
```

**OK パターン（推奨）**

```ts
// mutation 成功直後、UI 操作（ダイアログを閉じる等）を挟む前に subscription の更新を確認する
// ダイアログが開いたままでも、DOM の別要素は参照できる
await expect(残金カード).toHaveText('...'); // ← mutation 直後にアサート
await page.keyboard.press('Escape');         // ← 確認してからダイアログを閉じる
```

**ルール**

1. mutation の結果を subscription 経由で確認するアサートは、mutation 直後（不要な UI
   操作を挟む前）に配置する。
2. Vercel Preview 対象の timeout は余裕を持って設定する（例: `20_000ms`）。
   ローカル（Vite dev）との応答速度差を前提に設計する。
3. ダイアログ・モーダルが開いている状態でも DOM の他の要素は参照できる。
   「ダイアログを閉じてから確認」とせず、確認できる最早のタイミングでアサートする。

### Convex 関数追加 PR の dev deployment 反映

新規の Convex 関数（query/mutation/action）を追加した PR を E2E で確認する際は、
**その関数が dev deployment に反映されていることを事前に確認する。**

E2E の実行対象（Vercel Preview）は dev Convex deployment を向いているため、
Convex 側の関数が未デプロイだと `FunctionNotFound` エラーになる。

```bash
# feature branch の Convex 関数を dev deployment に反映する
npx convex dev --once
```

worktree 環境では、mainのworktree と dev deployment が共有される場合がある。
branch 切り替え後は必ず `npx convex dev --once` を実行して、使用中の関数が
dev に揃っていることを確認する。

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

## コミット粒度

コード変更は、**まとまった意味のある単位でコミット**します。細かすぎる作業ログや
大きすぎる一括コミットは避け、後から変更履歴を追跡・レビューしやすくします。

### 基本方針

- 1 つのコミットは 1 つの論理的な変更を表す。
- コミットメッセージは「何をしたか」ではなく「**なぜ変更したか**」が伝わるように書く。
- WIP（作業中）コミットは Pull Request をマージする前に整理（squash またはreword）する。

### コミットする単位の目安

| 変更の種類                             | 推奨コミット単位                                           |
| -------------------------------------- | ---------------------------------------------------------- |
| 新機能の実装                           | 機能が動作する最小単位（テストとセットで 1 コミット）      |
| バグ修正                               | 修正と再発防止テストをまとめて 1 コミット                  |
| リファクタリング                       | 振る舞いを変えない変更のみ 1 コミット（修正と混在させない） |
| スキーマ・index 変更                   | schema / index 変更を migration / backfill とセットで 1 コミット |
| ドキュメント更新                       | コード変更と分け、ドキュメントだけで 1 コミット            |
| 設定・依存関係更新                     | 目的ごとにまとめて 1 コミット                              |

### コミットしてはいけない内容

- `console.log` やデバッグコードを含むコミット（マージ前に除去する）
- 無関係な変更を混在させたコミット（例: バグ修正とリファクタリングを同一コミットに入れる）
- secret、token、APIキー、個人情報を含むコミット

### コミットメッセージの形式

このプロジェクトでは厳密な Conventional Commits の強制はしませんが、
次の形式を推奨します。

```
<type>: <要約（日本語可）>

<本文: なぜこの変更が必要だったか、何を解決したか（省略可）>
```

`<type>` の目安: `feat` / `fix` / `refactor` / `chore` / `docs` / `test`

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
- マージ後、原因、影響、再発防止の後続対応を Issue または Pull Request に記録する。

緊急 hotfix 時に、必須 CI が無関係な環境要因でブロックされている場合のみ、
Tech Lead はリスク、手動確認内容、後続 Issue を記録したうえでマージを承認できます。

Hotfix を通常のレビュー回避手段として使ってはいけません。

## Project 管理

初期段階では、厳密な GitHub Projects 運用は必須にしません。

まずは Issue と Pull Request を作業の正本とします。複数の作業を横断して
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

- CODEOWNERS の範囲を `convex/` と `.github/` 以外にも広げる。
- 計画管理に GitHub Projects を導入する。
- coverage 閾値を設定する。
- リリースノートまたは tag ベースのリリース運用を定義する。
- 大きなアーキテクチャ判断に ADR を導入する。
- Convex migration/backfill ルールを専用ドキュメントに分離する。

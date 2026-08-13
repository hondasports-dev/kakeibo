---
name: verification
description: 実装後に静的解析、unit/component/Convex、coverage、E2E、build、browser/runtime確認を実行し、Evidence付きでVerification Gateを判定する。
---

# Verification

## 目的

「テストを追加した」「動くはず」ではなく、**実行した結果**で正しさを証明する。

旧 `verify-pre-push`、`e2e-author`、`e2e-smoke-run`、`browser-verification` とテストケースレビューの再利用可能部分を統合する。

## 前提

- `IMPLEMENTATION: PASS`
- 実装のscope integrity check済み
- `package.json` の現在のscriptを正本としてコマンドを選ぶ

## 1. Verification Planを確定する

変更内容から必要な層を選ぶ。

- lint / format
- unit / component
- Convex tests
- coverage
- integration
- E2E
- build
- browser / runtime

`not_required` にする場合は、単なる省略ではなく要件上の根拠を書く。

## 2. 基本チェック

コード変更では原則として次を実行する。

```bash
pnpm test --run
pnpm run lint
pnpm run format:check
pnpm run build
```

並列実行してもよいが、各終了結果を個別に確認する。

Coverageが必要な変更では現在のscriptに従って実行する。

```bash
pnpm run test:coverage
```

全体値だけでなく、変更したロジックが十分に検証されているかを見る。

## 3. テストケース妥当性

最低限、変更に応じて次を検討する。

### 正常系
- テスト名が条件と期待結果を示す
- 業務仕様に対応する結果をassertする

### 境界・エッジ
- 0 / 最小 / 最大 / 境界前後
- 空文字 / 空白 / 特殊文字
- 空配列 / 1件 / 多数 / 重複
- 月末 / 年跨ぎ / 週跨ぎ / timezone
- `undefined` / `null` / 省略

### 準異常
- 未ログイン / 未所属 / 権限不足 / データなし
- 旧データ / 部分入力 / whitespace
- 競合 / 重複登録 / OCC
- 外部依存の不完全状態

### 異常
- auth / authorization拒否
- validation error
- DB / network / external service failure
- rollbackやユーザー向けerror

曖昧な `toBeDefined()` だけで仕様を証明した扱いにしない。

## 4. E2E要否

E2Eを追加・更新する代表条件:

- ユーザー導線の追加・変更
- 認証・認可
- 保存・削除・主要navigation
- 複数層を跨がないと証明できないAcceptance Criteria

省略可能な代表条件:

- unit/component/Convex testで十分証明できる
- docsのみ
- typo
- 振る舞い不変のリファクタ

**環境不足・実行失敗は省略理由にならない。**

## 5. E2E環境Gate

`src/**`、`convex/**`、`e2e/**` などE2E対象変更では、既存の正本運用に従う。

1. worktree作成時に `preview` 用の正本 `.env.local` を同期する
2. E2E / Convex反映直前に:

```bash
pnpm run e2e:env-sync
```

これが次を成功させるまで先へ進まない。

- `.env.local` 正本同期
- Convex devへ `E2E_CLEANUP_SECRET` 反映
- cleanup認証確認

`convex/**` 変更時は同期成功後:

```bash
pnpm exec convex dev --once
```

必要なE2Eを実行する。

```bash
pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
# または
pnpm run e2e -- --project=chromium
# dependency等のgolden path確認
pnpm run e2e:smoke -- --project=chromium --workers=1
```

Playwright browser不足なら必要なbrowserを導入して再実行する。

## 6. E2E作成品質

- 既存helper / patternに合わせる
- role / label / test idを優先
- strict modeで複数matchしうるlocatorを曖昧なまま使わない
- spec追加後は対象specを単体実行する
- 共有Clerk user / Dev DBがある場合、無理なworker増加で競合させない

## 7. Browser / Runtime確認

UI変更で自動テストだけでは見えない場合は、localまたはPreviewで主要フローを確認する。

確認例:

- error overlayなし
- expected heading / state
- console errorなし
- network failureなし
- loading / empty / error state
- desktop / mobileの主要viewport

Productionやsecret / PIIが関わる画面を無断で検査しない。

## 8. Evidence

各checkについて必ず記録する。

```text
name:
command / method:
status: PASS | FAIL | BLOCKED | NOT_REQUIRED
evidence:
```

「CIで後から実行される」はローカル必須GateをPASSさせる理由にならない。

## FAIL時

- 同じ失敗を惰性で繰り返さない
- 1回目: エラーから原因候補を切り分ける
- 同じ失敗2回目: `incident` Skillへ
- 実装不備なら修正後、必要なVerification一式を再実行する

## ハードストップ

- 必須基本チェックが未実行 / FAIL
- 必須E2Eが未実行 / FAIL
- `e2e:env-sync` が必要なのにFAIL
- Convex反映が必要なのにFAIL
- 環境問題を記録しただけでCode Reviewへ進もうとしている

## 出力

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Checks:
Test adequacy:
Coverage:
E2E:
Browser/runtime:
Skipped checks and reasons:
Evidence:
```

PASS後 `code-review` へ進む。
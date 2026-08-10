---
name: verify-pre-push
description: 変更パスに応じて基本4本、.env.local 同期、Convex 反映、ローカル E2E を実行し、push 可否を判定する。Plan 契約フェーズ3または push 前検証で使う。
---

# push 前検証（Plan 契約フェーズ3）

## 目的

変更に必要な検証をすべて実行し、証拠付きで次の `code-review` へ渡す。

## 入力

- `origin/preview...HEAD` の変更ファイル一覧
- GATE0 と TDD/E2E の検証方針

## 前提

- フェーズ1 TDD、フェーズ2 E2E（該当時）が完了している
- コマンド正本: **AGENTS.md**「Push前検証」、**docs/development-process.md**「ローカル E2E 実行」

## 差分の判定

```bash
git fetch origin preview
git diff origin/preview...HEAD --name-only
```

## チェックリスト

### 1. 基本4本（常に並列）

```bash
pnpm test --run & pnpm run lint & pnpm run format:check & pnpm run build &
wait
```

### 2. `.env.local` 同期（`convex/**`、`src/**`、`e2e/**` のいずれかを変更した場合）

worktree では、作成直後に `preview` 用 worktree の正本 `.env.local` をコピーしてから作業する。
正本がまだ無い場合は `docs/development-process.md` の bootstrap 手順で最初の worktree の
`.env.local` から正本を復旧する。

Convex 反映または E2E の直前には毎回、次を実行する。

```bash
pnpm run e2e:env-sync
```

`e2e:env-sync` は次をすべて完了させる必須ゲートとする。

- `preview` 用 worktree の正本 `.env.local` を現在の worktree へコピー
- Convex dev deployment へ `E2E_CLEANUP_SECRET` を反映
- cleanup 認証の成功確認

`.env.local` 不足、Convex CLI 認証不足、cleanup 認証失敗を理由にこの手順を省略しない。
不足を復旧して再実行し、成功するまで後続へ進まない。秘密値の扱いは `service-ops-safety` に従う。

### 3. `convex/**` 変更時（`_generated/` 除く）

`.env.local` 同期の成功後に dev deployment へ変更を反映する。

```bash
pnpm exec convex dev --once
```

失敗した場合は原因を解消して再実行する。失敗したままローカル E2E、review、push、PR 作成へ進まない。

### 4. `src/**` または `e2e/**` 変更時

a. **Playwright** — 未導入なら `pnpm exec playwright install chromium`

b. **E2E 実行** — 変更範囲に応じて該当 spec / smoke / 全件

```bash
pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
# または
pnpm run e2e -- --project=chromium
```

ローカル E2E が失敗または実行不能なら、原因を解消して再実行する。
「実行不能理由を Issue / PR に記録して CI に委ねる」は完了条件にしない。

## 完了条件

- 上記の該当項目がすべて成功している
- `.env.local` 同期、必要な Convex 反映、必要なローカル E2E の未完了項目がない
- 次フェーズ: `code-review`（PASS まで push 禁止）

## 停止条件

- 基本4本が失敗または未実行
- 正本 `.env.local` が無く、bootstrap / 同期が完了していない
- `pnpm run e2e:env-sync` が失敗している
- `convex/**` 変更で `pnpm exec convex dev --once` が成功していない
- `src/**` / `e2e/**` 変更でローカル E2E が成功していない
- 検証失敗や実行不能を記録だけして次フェーズ、push、PR 作成へ進もうとしている

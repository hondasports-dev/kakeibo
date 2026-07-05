---
name: verify-pre-push
description: Plan 契約フェーズ3。push 前検証（基本4本、convex dev --once、ローカル E2E）。コマンド正本は AGENTS.md と development-process.md。
triggers:
  - user
  - model
---

# push 前検証（Plan 契約フェーズ3）

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

### 2. `convex/**` 変更時（`_generated/` 除く）

```bash
pnpm exec convex dev --once
```

### 3. `src/**` または `e2e/**` 変更時

a. **`.env.local` 同期**（E2E 直前毎回。worktree 作成直後も同手順）

- 正本: `docs/development-process.md`「`.env.local` 同期」
- **コマンド**: `pnpm run e2e:env-sync`（`pnpm run e2e` / `e2e:smoke` も先頭で実行）
- 秘密値の扱いは `service-ops-safety` に従う

b. **Playwright** — 未導入なら `pnpm exec playwright install chromium`

c. **E2E 実行** — 変更範囲に応じて該当 spec / smoke / 全件

```bash
pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
# または
pnpm run e2e -- --project=chromium
```

実行不能な場合のみ Issue / PR に理由を記録し CI に委ねる（**成功扱いにしない**）。

## 完了条件

- 上記該当項目がすべて成功、または実行不能理由が記録済み
- 次フェーズ: `code-review`（PASS まで push 禁止）

## 危険信号

- 基本4本未実行で push しようとしている
- `src/**` / `e2e/**` 変更でローカル E2E を CI 任せにしている
- 検証失敗を成功扱いにしている

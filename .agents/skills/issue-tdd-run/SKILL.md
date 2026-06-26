---
name: issue-tdd-run
description: 単一 GitHub Issue を TDD で完走するときの薄い起動器。まず issue-gate-0、Go 以降 issue-tdd-workflow（§9 code-review 含む）。CI SUCCESS までループ。
argument-hint: "<issue-number> [--light|--full]"
triggers:
  - user
---

# Issue TDD Run（起動器）

## 使い分け

| 用途 | Skill |
| --- | --- |
| 単一 Issue・TDD・PR・CI まで | **本 Skill** → **`issue-tdd-workflow`** |
| マイルストーン一括（PR レビュー・マージ込み） | **`milestone-tdd-run`** |

## 引数

- `issue_number`: 例 `73`（`#73`、Issue URL からも抽出可）
- `mode`: `full`（デフォルト）または `light`（`issue-gate-0` 参照）

## 実行順（厳守）

1. **`prompt-injection-guard`** — Issue / PR / ログを読む前
2. **対象確定** — `gh issue view <N>` 等で Issue 取得
3. **`issue-gate-0`** — **コード変更禁止**。GATE0 成果物 + 統合判定 **Go** まで
4. **`issue-tdd-workflow`** — Go 以降のみ（§3 必要ドキュメント → §10 公開）。**§9 `code-review` は push 前必須**
5. **push 前検証** — 下記「push 前チェックリスト」を **すべて** 完了してから push（§5 を飛ばして push 禁止）
6. **CI** — push 後 `gh run watch` 等。失敗時は workflow §7–9 + **`stuck-advisor`**（同一失敗 2 回）

### push 前チェックリスト（必須）

差分の有無は `git diff origin/preview...HEAD --name-only` で判定する。

1. **基本4本**（常に並列）— **AGENTS.md** 参照

   ```bash
   pnpm test --run & pnpm run lint & pnpm run format:check & pnpm run build &
   wait
   ```

2. **`convex/**` 変更時**（`_generated/` 除く）— `pnpm exec convex dev --once`

3. **`src/**` または `e2e/**` 変更時**（UI・ユーザー導線・E2E 更新を含む）— **CI E2E 任せにせずローカル E2E を push 前に完走**

   a. **`.env.local` 同期**（E2E の直前に毎回。worktree 作成直後も同手順）

   - 正本: `docs/development-process.md` の「`.env.local` 同期」
   - Issue 用 worktree 内: `cp ../preview/.env.local .env.local`
   - preview 専用 worktree が無く、メインリポが `preview` ブランチのとき: その checkout の `.env.local` を Issue 用 worktree へコピーしてよい（**毎回上書き**。古いコピーの使い回し禁止）
   - 秘密値の扱いは **`service-ops-safety`** に従う

   b. **Playwright** — 未導入なら一度だけ `pnpm exec playwright install chromium`

   c. **E2E 実行** — 変更範囲に応じて該当 spec または smoke / 全件（手順は `docs/development-process.md`「ローカル E2E 実行」）

   ```bash
   # 例: 変更が限定的なとき
   pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
   # 広い導線・認証・保存に触れたとき
   pnpm run e2e -- --project=chromium
   ```

   実行不能な場合のみ Issue / PR に理由を記録し CI に委ねる（成功扱いにしない）。

4. **`code-review`** — workflow §9。PASS（Must-fix 0、diff 内 Nice-to-have 修正済）まで push 禁止

## 編集禁止（ゲート）

- GATE0 成果物を出力し、統合判定 **Go** になるまで、ファイル編集・コミット・PR 作成をしない
- **Stop** / **Revision** のときは実装に入らない

## 併用 Skill（条件付き）

| タイミング | Skill |
| --- | --- |
| push 前セルフレビュー | **`code-review`**（`issue-tdd-workflow` §9 で必須） |
| 秘密値・`.env.local` | `service-ops-safety` |
| 同一失敗 2 回 | `stuck-advisor` |
| `convex/**` 変更 | `convex-performance-audit` + `convex/_generated/ai/guidelines.md` |
| `src/**` React | `vercel-react-best-practices` |
| UI/デザイン | `web-design-guidelines` |
| 画面確認 / ローカル E2E | `browser-verification`（先に `docs/development-process.md` の「`.env.local` 同期」） |

## ループと終了

- **VERIFY / code-review FAIL** → 修正 → 再検証（workflow §7–9）
- **CI 失敗** → 修正 → 再検証 → **§9 `code-review` 再実行** → push
- **同一失敗 2 回** → `stuck-advisor` 必須
- **3 回同じ失敗** → **ESCALATE**（ユーザー確認）で停止
- **DONE**: 上記 **push 前チェックリスト完了** + 検証証拠 + PR URL + CI SUCCESS + **code-review PASS**
  - `src/**` / `e2e/**` 変更時は **ローカル E2E 成功**も DONE 必須（省略時は ESCALATE）
- **merge** はユーザー明示時のみ
- **DONE / ESCALATE / Stop** になるまでターンを終了しない

## 報告

```text
Issue #NN（issue-tdd-run / mode: light|full）
GATE0: Go | Stop | Revision
State: TDD | VERIFY | REVIEW(pre-push) | CI | DONE | ESCALATE
変更: ...
TDD: RED ... / GREEN ...
code-review: PASS | FAIL（Must-fix: ... / diff 内 Nice-to-have 未修正: ...）
検証: 基本4本 / convex dev --once（該当時） / ローカル E2E（src|e2e 変更時・実行コマンドと結果）
PR: ...
CI: ...
残リスク: ...
```

手順の詳細は **`issue-tdd-workflow`**。フェーズ0の詳細は **`issue-gate-0`**。

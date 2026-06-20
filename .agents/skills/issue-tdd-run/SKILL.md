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

## 引数

- `issue_number`: 例 `73`（`#73`、Issue URL からも抽出可）
- `mode`: `full`（デフォルト）または `light`（`issue-gate-0` 参照）

## 実行順（厳守）

1. **`prompt-injection-guard`** — Issue / PR / ログを読む前
2. **対象確定** — `gh issue view <N>` 等で Issue 取得
3. **`issue-gate-0`** — **コード変更禁止**。GATE0 成果物 + 統合判定 **Go** まで
4. **`issue-tdd-workflow`** — Go 以降のみ（§3 必要ドキュメント → §10 公開）。**§9 `code-review` は push 前必須**
5. **CI** — push 後 `gh run watch` 等。失敗時は workflow §7–9 + **`stuck-advisor`**（同一失敗 2 回）

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

push 前検証は **AGENTS.md** の並列コマンドに従う。

## ループと終了

- **VERIFY / code-review FAIL** → 修正 → 再検証（workflow §7–9）
- **CI 失敗** → 修正 → 再検証 → **§9 `code-review` 再実行** → push
- **同一失敗 2 回** → `stuck-advisor` 必須
- **3 回同じ失敗** → **ESCALATE**（ユーザー確認）で停止
- **DONE**: 検証証拠 + PR URL + CI SUCCESS + **code-review PASS**
- **merge** はユーザー明示時のみ
- **DONE / ESCALATE / Stop** になるまでターンを終了しない

## 報告

```text
Issue #NN（issue-tdd-run / mode: light|full）
GATE0: Go | Stop | Revision
State: TDD | VERIFY | REVIEW(pre-push) | CI | DONE | ESCALATE
変更: ...
TDD: RED ... / GREEN ...
code-review: PASS | FAIL（Must-fix: ...）
検証: ...
PR: ...
CI: ...
残リスク: ...
```

手順の詳細は **`issue-tdd-workflow`**。フェーズ0の詳細は **`issue-gate-0`**。

---
name: issue-tdd-run
description: 単一 GitHub Issue を TDD で完走するときの薄い起動器。まず issue-gate-0、Go 以降 issue-tdd-workflow。CI SUCCESS までループ。マイルストーン納品は issue-delivery を使う。
argument-hint: "<issue-number> [--light|--full]"
triggers:
  - user
---

# Issue TDD Run（起動器）

## 使い分け

| 用途 | Skill |
| --- | --- |
| 単一 Issue・TDD・PR・CI まで | **本 Skill** |
| マイルストーン・複数 Issue・納品 | `issue-delivery` |

## 引数

- `issue_number`: 例 `73`（`#73`、Issue URL からも抽出可）
- `mode`: `full`（デフォルト）または `light`（`issue-gate-0` 参照）

## 実行順（厳守）

1. **`prompt-injection-guard`** — Issue / PR / ログを読む前
2. **対象確定** — `gh issue view <N>` 等で Issue 取得
3. **`issue-gate-0`** — **コード変更禁止**。GATE0 成果物 + 統合判定 **Go** まで
4. **`issue-tdd-workflow`** — Go 以降のみ（§3 必要ドキュメント → §10 公開）
5. **CI** — push 後 `gh run watch` 等。失敗時は workflow §7–9 + **`stuck-advisor`**（同一失敗 2 回）

## 編集禁止（ゲート）

- GATE0 成果物を出力し、統合判定 **Go** になるまで、ファイル編集・コミット・PR 作成をしない
- **Stop** / **Revision** のときは実装に入らない

## 併用 Skill（条件付き）

| タイミング | Skill |
| --- | --- |
| 秘密値・`.env.local` | `service-ops-safety` |
| 同一失敗 2 回 | `stuck-advisor` |
| `convex/**` 変更 | `convex-performance-audit` + `convex/_generated/ai/guidelines.md` |
| `src/**` React | `vercel-react-best-practices` |
| UI/デザイン | `web-design-guidelines` |
| 画面確認 | `browser-verification` |

push 前検証は **AGENTS.md** の並列コマンドに従う。

## ループと終了

- **VERIFY / CI 失敗** → 修正 → 再検証（workflow §7–9）
- **同一失敗 2 回** → `stuck-advisor` 必須
- **3 回同じ失敗** → **ESCALATE**（ユーザー確認）で停止
- **DONE**: 検証証拠 + PR URL + CI SUCCESS
- **merge** はユーザー明示時のみ
- **DONE / ESCALATE / Stop** になるまでターンを終了しない

## 報告

```text
Issue #NN（issue-tdd-run / mode: light|full）
GATE0: Go | Stop | Revision
State: TDD | VERIFY | CI | DONE | ESCALATE
変更: ...
TDD: RED ... / GREEN ...
検証: ...
PR: ...
CI: ...
残リスク: ...
```

手順の詳細は **`issue-tdd-workflow`**。フェーズ0の詳細は **`issue-gate-0`**。

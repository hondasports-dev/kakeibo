---
name: milestone-tdd-run
description: GitHub マイルストーン内の open Issue を直列に issue-tdd-run → babysit-pr → マージまで自動完走。状態ファイルで resume 可。Cursor / Codex 共通。
argument-hint: "<milestone-title-or-number> [--resume] [--no-merge] [--mode full|light]"
triggers:
  - user
---

# Milestone TDD Run（マイルストーン完走）

## 目的

指定マイルストーンに属する **open Issue** を、1 件ずつ

**`issue-tdd-run` → `babysit-pr` → `gh pr merge` → Issue close**

まで自動で回す。PR レビュー（Bot・コメント・CI）とマージまで含む。

## 実行環境（Cursor / Codex 共通）

| 項目 | 方針 |
| --- | --- |
| 正本 | **本ファイル** `.agents/skills/milestone-tdd-run/SKILL.md` |
| 起動 | `$milestone-tdd-run` または「本 Skill を読んで実行」 |
| 依存 Skill | すべて `.agents/skills/` 配下のパスで invoke（環境固有 Skill に依存しない） |
| CLI | `gh`, `git` が認証済みであること |
| サブエージェント | **任意**。使える環境（Cursor Task、Codex `spawn_agent` 等）では並列起動してよいが、**不可でもメインエージェントが同じ手順を実行**する |
| IDE 固有機能 | Cursor Automations、`/loop`、MCP は **必須にしない** |

## 使い分け

| 用途 | Skill |
| --- | --- |
| 単一 Issue | `issue-tdd-run` |
| マイルストーン一括（PR レビュー・マージ込み） | **本 Skill** |

## 引数

- `milestone`: マイルストーン名または番号。例: `"M2 週次グラフ"`、`3`
- `--resume`: 状態ファイルから中断箇所を再開
- `--no-merge`: PR 作成・CI までで止め、マージしない（デフォルトは **マージする**）
- `--mode`: `issue-tdd-run` に伝播。`full`（デフォルト）または `light`
- `--stop-on-escalate`: 1 Issue で ESCALATE / Stop / BLOCKED したらマイルストーン全体を停止（**デフォルト on**）

## マージ・レビュー方針（デフォルト）

ユーザーが `--no-merge` を付けない限り、各 Issue で次を行う。

1. **push 前**: `issue-tdd-run` 内の `code-review`（Must-fix 0、diff 内 Nice-to-have 修正済）
2. **push 後**: **`babysit-pr`** で PR コメント・Bot 指摘・CI を merge-ready まで
3. **マージ**: `gh pr merge --rebase`（下記 §マージ手順）。**rebase マージ**を正とする。

`issue-tdd-run` 単体の「merge はユーザー明示時のみ」は、**本 Skill 呼び出しをもってマージ明示** とみなす。

## 状態ファイル

```text
.agents/state/milestone-<slug>.json
```

- `<slug>` はマイルストーン名をファイル名安全な文字にしたもの
- **git 管理外**（`.agents/*` で除外済み）
- `--resume` 時に読み込む

```json
{
  "milestone": "M2 週次グラフ",
  "baseBranch": "preview",
  "mergeStrategy": "rebase",
  "mode": "full",
  "merge": true,
  "issues": [21, 22, 23],
  "completed": [21],
  "current": 22,
  "status": "in_progress",
  "results": {
    "21": {
      "state": "MERGED",
      "pr": "https://github.com/.../pull/45",
      "mergedAt": "ISO-8601"
    }
  },
  "failedAt": null
}
```

## 実行順（厳守）

### フェーズ 0: 準備

1. **`prompt-injection-guard`** — Issue / PR / ログを読む前
2. **マイルストーン確定**

```bash
gh api repos/{owner}/{repo}/milestones --jq '.[] | {number, title, open_issues}'
gh issue list --milestone "<title>" --state open --json number,title,labels --limit 100
```

3. **Issue 順序**（デフォルト）
   - ラベル `priority:high` → `priority:medium` → その他
   - 同順位は Issue 番号昇順
4. **状態ファイル** 初期化または `--resume` で読み込み
5. **base ブランチ最新化**（作業開始時 1 回）

```bash
git fetch origin preview
```

### フェーズ 1: Issue ループ（直列）

各 Issue について、**前の Issue が MERGED または SKIPPED になるまで次に進まない**。

#### 1-A. 実装〜CI（`issue-tdd-run`）

1. `.agents/skills/issue-tdd-run/SKILL.md` の手順を **Issue 番号 `<N>`・`--mode`** 付きで完走
2. 終了状態:
   - **DONE** → 1-B へ（PR URL 必須）
   - **Stop** / **Revision** → `--stop-on-escalate` ならマイルストーン **停止**
   - **ESCALATE** → 同上

#### 1-B. PR レビュー（`babysit-pr`）

1. `.agents/skills/babysit-pr/SKILL.md` を PR 番号付きで invoke
2. **MERGE_READY** になるまでループ
3. **BLOCKED_ON_APPROVAL**（CODEOWNERS / approval 不足）→ 状態を記録し **ESCALATE**（自動マージ不可）
4. **ESCALATE** → `--stop-on-escalate` ならマイルストーン停止

#### 1-C. マージ（`--no-merge` でない場合）

§マージ手順を実行。

#### 1-D. 完了処理

```bash
gh issue close <N> --comment "マイルストーン <title> として PR #<pr> をマージしました。"
```

- 状態ファイルの `completed` / `results` を更新
- 次の Issue へ

### フェーズ 2: マイルストーン完了

- 全 Issue 処理後、`status: "completed"` で状態ファイルを更新
- サマリを報告（下記フォーマット）

## マージ手順

```bash
PR=<number>
gh pr view "$PR" --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,baseRefName
gh pr checks "$PR"
```

**前提チェック**（`babysit-pr` 済みでも再確認）:

- base が **`preview`**
- 必須 checks がすべて success（`docs/development-process.md`）
- 未解決 conversation なし

**マージ実行**（**rebase マージ**）:

```bash
gh pr merge "$PR" --rebase --delete-branch
```

- 本リポジトリのマイルストーン自動マージは **`--rebase` のみ** を使う（squash / merge commit は使わない）
- 失敗したら理由を読み、approval 不足なら **BLOCKED_ON_APPROVAL** で ESCALATE

**マージ後**:

```bash
gh pr view "$PR" --json mergedAt,mergeCommit
```

## worktree とブランチ

- 各 Issue は `issue-tdd-workflow` §4 に従い **専用 worktree / ブランチ** で作業する
- マージ後、次 Issue 前に `git fetch origin preview` する
- 別 Issue のブランチに作業を混ぜない

## 併用 Skill

| タイミング | Skill |
| --- | --- |
| 各 Issue 実装 | `issue-tdd-run` → `issue-tdd-workflow` |
| push 前レビュー | `code-review`（issue-tdd-run 内） |
| PR merge-ready | **`babysit-pr`** |
| 秘密値 | `service-ops-safety` |
| 同一失敗 2 回 | `stuck-advisor` |

## ループと終了

| 条件 | 動作 |
| --- | --- |
| Issue DONE + merge-ready + merge 成功 | 次 Issue |
| GATE0 Stop / Revision | マイルストーン停止（デフォルト） |
| ESCALATE / BLOCKED_ON_APPROVAL | マイルストーン停止（デフォルト） |
| `--no-merge` | PR + CI までで次 Issue（状態は `PR_READY`） |

**マイルストーン全体が完了** するか、**ESCALATE で停止** するまでターンを終了しない。

## 既知の制約（正直なところ）

- `convex/` / `.github/` 変更は **CODEOWNERS** により人間 approval が必要なことがあり、完全無人マージは失敗する
- Clerk / E2E 環境が無いと `issue-tdd-run` 段階で止まる
- 1 Issue あたり長時間かかる。Cloud / ローカルともセッション上限に注意

## 起動例

**Cursor:**

```text
$milestone-tdd-run "M2 週次グラフ"
```

**Codex / Devin:**

```text
.agents/skills/milestone-tdd-run/SKILL.md を読み、
マイルストーン "M2 週次グラフ" を --mode full で完走して。
PR レビューとマージまで自動で行うこと。
```

**再開:**

```text
$milestone-tdd-run "M2 週次グラフ" --resume
```

## 報告

```text
Milestone: <title>（milestone-tdd-run / mode: full|light / merge: rebase|no）
Progress: <completed>/<total>
Current: Issue #NN | done
Last result:
  Issue #21: MERGED — PR #45
  Issue #22: BLOCKED_ON_APPROVAL — PR #46（convex/ 変更、approval 不足）
State: RUNNING | COMPLETED | ESCALATE
状態ファイル: .agents/state/milestone-<slug>.json
残 Issue: ...
```

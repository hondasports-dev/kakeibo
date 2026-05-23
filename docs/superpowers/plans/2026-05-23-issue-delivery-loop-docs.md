# Issue Delivery Loop Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `issue-delivery` を Issue タスクと PR 終了条件タスクを基点に、要件定義から PR マージまで全自動で進められるドキュメント構成へ更新する。

**Architecture:** `.agents/skills/issue-delivery/SKILL.md` を実行時の正本とし、フェーズ前に共通のタスク台帳・状態遷移・自動ループ規約を置く。`docs/development-process.md` にはチーム運用としての Issue/PR tracking と E2E 完走条件を短く追加し、Skill の詳細手順へリンクする。

**Tech Stack:** Markdown, GitHub Issue/PR checklist, GitHub Actions, Playwright E2E, pnpm, Codex/Devin subagent delegation.

---

### Task 1: 保存前の差分確認

**Files:**
- Read: `.agents/skills/issue-delivery/SKILL.md`
- Read: `docs/development-process.md`
- Read: `docs/qa-checklist.md`

- [x] **Step 1: 作業前差分を確認する**

Run: `git status --short`
Expected: 既存の未コミット変更を把握する。

- [x] **Step 2: issue-delivery の既存変更を確認する**

Run: `git diff -- .agents/skills/issue-delivery/SKILL.md`
Expected: ユーザーまたは既存作業のループ管理追記を把握し、削除せずに拡張する。

### Task 2: issue-delivery Skill の共通ループ基盤を追加する

**Files:**
- Modify: `.agents/skills/issue-delivery/SKILL.md`

- [x] **Step 1: 冒頭に「最終ゴール」と「全体状態遷移」を追加する**

Add sections after the prerequisites:

```markdown
## 最終ゴール

Issue の要件定義から PR マージまでを、Issue と PR のタスクを source of truth として全自動で進める。
```

- [x] **Step 2: Issue タスク台帳と PR 終了条件タスクを追加する**

Add sections that define:

```markdown
## Issue タスク台帳
## PR 終了条件タスク
```

Expected: 人間とエージェントが同じ checklist を見て進捗を追える。

- [x] **Step 3: 自動ループ制御を追加する**

Add transition rules for `TDD実装 -> コードレビュー -> ローカルE2E -> GitHub Actions -> 修正 -> 再確認 -> merge`.

Expected: レビュー差し戻し、ローカル E2E 失敗、GitHub Actions 失敗のいずれも次の行き先が明確になる。

### Task 3: 各フェーズへタスク更新ルールを接続する

**Files:**
- Modify: `.agents/skills/issue-delivery/SKILL.md`

- [x] **Step 1: フェーズ0からフェーズ1.5へ Issue タスク更新を追加する**

Expected: 要件定義、仕様確定、E2E設計レビューの完了が Issue checklist に反映される。

- [x] **Step 2: フェーズ2へ TDD とローカル E2E 完走条件を追加する**

Expected: `pnpm test --run`、`pnpm run lint`、`pnpm run build`、`pnpm run e2e --project=chromium` をローカルで完走する前提になる。

- [x] **Step 3: フェーズ3からフェーズ5へ自動差し戻しを追加する**

Expected: Reviewer と QA Agent の判定結果をもとに、Implementer または E2E テスト修正へ自動で戻る。

- [x] **Step 4: フェーズ6を PR マージまで拡張する**

Expected: GitHub Actions 全完走、未解決レビューなし、PR 終了条件タスク完了後に merge する。

### Task 4: 開発プロセス文書へ運用ルールを追加する

**Files:**
- Modify: `docs/development-process.md`

- [x] **Step 1: Issue 運用にタスク台帳ルールを追加する**

Expected: Issue checklist が agent と人間の共通進捗管理になることを明記する。

- [x] **Step 2: Pull Request 運用に終了条件タスクを追加する**

Expected: PR 側にも merge までの checklist を置く。

- [x] **Step 3: E2E 方針をローカル全完走必須へ更新する**

Expected: issue-delivery ではローカル E2E を CI 任せにせず、環境要因で実行不能な場合のみ理由を Issue/PR に記録する。

### Task 5: 検証

**Files:**
- Review: `.agents/skills/issue-delivery/SKILL.md`
- Review: `docs/development-process.md`
- Review: `docs/superpowers/plans/2026-05-23-issue-delivery-loop-docs.md`

- [x] **Step 1: Markdown 内の主要語を検索する**

Run: `rg -n "Issue タスク台帳|PR 終了条件タスク|自動ループ|pnpm run e2e --project=chromium|マージ" .agents/skills/issue-delivery/SKILL.md docs/development-process.md`
Expected: 追加した運用ルールが両方の文書に存在する。

- [x] **Step 2: 差分を確認する**

Run: `git diff -- .agents/skills/issue-delivery/SKILL.md docs/development-process.md docs/superpowers/plans/2026-05-23-issue-delivery-loop-docs.md`
Expected: 既存のサブエージェント起動記述を残し、タスク駆動の自動ループが追加されている。

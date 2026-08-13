---
name: delivery
description: Security Review PASS後、commit/push/PR作成からCI・レビュー対応・merge-ready・必要時merge・Issue/branch/worktree後始末までを状態管理する。
---

# Delivery Lifecycle

## 目的

「pushした」「CIが1本通った」「PRを作った」を完了と誤認せず、要求されたDelivery targetまで確実に進める。

旧 `babysit-pr` から、PR全体のchecks、未解決review thread、conflict、approval、merge-ready判定、CI修正ループを継承する。

## 前提

- `VERIFICATION: PASS`
- `CODE_REVIEW: PASS`
- `SECURITY_REVIEW: PASS` または根拠付き `NOT_REQUIRED`
- scope integrityを再確認済み

## Delivery target

開始時に今回の終了点を決める。

- `pr_created`: ユーザーが明示的にPR作成までを依頼
- `merge_ready`: **通常のデフォルト**。PR作成後、必須CIとレビュー指摘を解消し、merge可能な状態まで
- `merged_cleaned`: ユーザーがmergeまで依頼、または明示的な運用契約がある場合。merge後の後始末まで

merge権限があることと、mergeしてよいことを同一視しない。

## 1. Commit前最終確認

- intended diffだけか
- untrackedを見落としていないか
- secret / `.env.local` が含まれないか
- generated / artifactの不要ファイルがないか
- Verification / Review後に未検証の変更を追加していないか

未検証変更があればVerificationへ戻る。

## 2. Commit / Push

- task専用branchを使う
- intended filesだけstageする
- unrelated user changesを含めない
- commit messageは差分の目的を表す
- push後、remote branchが存在することを確認する

## 3. PR作成

PRには最低限以下を含める。

- 何を変えたか
- なぜ変えたか
- 主要な設計判断
- Verification evidence
- 既知のリスク / follow-up
- 関連Issue

**Draftはデフォルトにしない。** ユーザーがDraftを求めた場合、または意図的に未完成状態を共有する場合だけDraftにする。

PR作成後、URL・base・head・Draft状態を実データで確認する。

## 4. PR Aftercare

PRを作ったらtargetに応じて次を追う。

### CI

PR全体の必須checkを確認する。単一workflow runのsuccessだけで判断しない。

代表例:

- CI: lint / build / test / coverage
- E2E
- CodeQL等のrequired check

FAILした場合:

- code changeが必要 → `IMPLEMENTATION → VERIFICATION → CODE_REVIEW → SECURITY_REVIEW → DELIVERY`
- environment / infra → `incident`
- workflowを弱めて通すことを回避策にしない

### Review comments / Bot findings

- unresolved threadを確認する
- CodeRabbit等のbot指摘も妥当性を判断する
- 妥当なコード修正はDelivery内で直接patchして終わらせず、Implementationへ戻す
- 不採用なら理由をthread / PR contextに残す
- 差分が変わったらVerificationとReviewsを再実行する

### Conflict

base更新によるconflictがあれば意図を保ってrebase/merge方針を選ぶ。

conflict解消でcodeが変わったらVerification以降を再実行する。

### Approval

CODEOWNERS / branch protection等で人間approvalが必要なら自動approvalで迂回せず `BLOCKED_ON_APPROVAL` とする。

## 5. Merge-ready Gate

次をすべて確認する。

- Draftでない
- required checksがsuccess
- unresolved blocking review threadがない
- requested changesが未解決でない
- conflictなし / mergeable
- required approvalを満たす
- headが最新の検証済みcommit

ここまでで `merge_ready` targetはPASS。

## 6. Merge（targetがmerged_cleanedの場合）

- merge直前にPR headとchecksを再確認
- repository方針に合うmerge methodを使う
- merge結果を実データで確認する
- mergeされたcommit / baseを確認する

## 7. 後始末

merge後または明示的な作業終了時に確認する。

### GitHub

- Issueが期待通りclose / updateされたか
- 必要なfollow-up Issueが残されているか
- 不要になったremote task branchを削除するか判断

### Local / worktree

- task worktreeに未commit / untrackedの必要データがないことを確認
- **このタスク用に作成したworktreeだけ**を対象にする
- canonical `preview` 作業場所や正本 `.env.local` を保持する場所を勝手に削除しない
- worktree削除前に `git status` とpush/merge済みを確認する
- stale worktree entryがあれば安全確認後pruneする

「後始末」のために未保存作業を削除しない。

## 8. Delivery Evidence

```text
Branch:
Commit:
PR URL:
Base / head:
Draft: yes/no
Checks:
Review threads:
Approval:
Mergeable:
Merge result:
Issue state:
Branch cleanup:
Worktree cleanup:
```

## FAIL / BLOCKED

- code修正 → Implementationへ戻る
- CI/E2E原因不明 → Incident
- approval待ち → BLOCKED_ON_APPROVAL
- merge conflictで仕様判断が必要 → Requirements / Human Gate

## 出力

```text
DELIVERY
Target: pr_created | merge_ready | merged_cleaned
Status: PASS | FAIL | BLOCKED
PR:
Checks:
Reviews:
Merge state:
Issue state:
Cleanup:
Remaining blockers:
Evidence:
```

要求されたtargetまで到達する前にDONEへ進まない。
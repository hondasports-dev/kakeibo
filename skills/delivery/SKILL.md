---
name: delivery
description: Security Review PASS後、レビュー済みheadをcommit/pushし、現在taskに紐づくPRを作成または更新してPR identityを固定する。PR公開checkpointへ進むときに使う。
license: Apache-2.0
---

# Delivery Publish

## 目的

レビュー済みの変更をGitHubへ公開し、現在taskのDelivery PRを確定する。

**PR作成はcheckpointであり、通常の完了条件ではない。** このSkillのPASS後は `pr-aftercare` へ進む。

## 前提

- `VERIFICATION: PASS`
- `CODE_REVIEW: PASS`
- `SECURITY_REVIEW: PASS` または根拠付き `NOT_REQUIRED`
- scope integrity確認済み
- 常時必須Skillを適用済み

VerificationのためのPreview/E2E用candidate branch pushはDelivery Evidenceに数えない。Security Review後の検証済みheadをあらためて公開対象とする。

## Delivery target

通常のtargetは次の2つだけ。

- `merge_ready`: デフォルト。PR公開後、AftercareでCI・review・approval・conflictを収束させる
- `merged_cleaned`: ユーザーがmergeまで明示した場合。Aftercareでmergeと後始末まで行う

`pr_created` はtargetではなくcheckpointとして扱う。

単に「PRを投げて」「PR作って」と言われた場合は `merge_ready` を使う。「PR作成までで止めて」等と明示された場合だけAftercareの例外候補とする。

## Session / Task invariant

通常は1 sessionにつきcurrent taskは1つ、current taskにつきDelivery PRは最大1つとする。

既に現在taskのPRが存在する場合、新しいPRを作らず同じbranch / PRを更新する。

Aftercareがterminalになる前に別taskのbranch / worktree / PRへ切り替えない。並行taskはユーザーが明示的に許可した場合だけ例外とする。

## 1. Publish前確認

- intended diffだけか
- untrackedを見落としていないか
- local-only fileや不要artifactを含めていないか
- Verification / Review後の未検証変更がないか
- baseとの差分に他task変更が混ざっていないか
- task ID / source / branch / worktree / Delivery targetが現在taskと一致するか

未検証変更があればVerificationへ戻る。

## 2. Commit / Push

- task専用branchを使う
- intended filesだけstageする
- unrelated changesを含めない
- commit messageは差分目的を表す
- push後にremote branchとhead SHAを実データで確認する

既存PR更新時も、pushしたhead SHAとPR head SHAが一致することを確認する。

## 3. PR create / update

PRが無い場合だけ作成する。既に現在taskのPRがある場合はそのPRを更新する。

PRには最低限次を含める。

- 何を変えたか / なぜ変えたか
- 主要な設計判断
- Verification evidence
- Code Review / Security Review結果
- 既知のリスク / follow-up
- 関連Issueまたは明示的なtask source

タイトル・本文・Agentが作成するコメントは原則日本語とする。

Draftはデフォルトにしない。明示的にDraftを求められた場合だけ使う。

## 4. PR identity確認

```text
Task ID:
Task source:
PR URL:
Base:
Head branch:
Published head SHA:
Draft:
State:
Delivery target:
```

「pushしたのでPRがあるはず」と推測しない。

## Gate

次を満たした場合だけPASSする。

- intended changesがcommit済み
- intended branchがpush済み
- 現在taskに紐づくDelivery PRがちょうど1つ
- PR metadataを実データで確認済み
- PR headが公開した検証済みheadと一致
- Delivery targetが `merge_ready` または `merged_cleaned`

ここではCIやreviewの成功を要求しない。それらは次の `PR_AFTERCARE` Gateが所有する。

## FAIL / BLOCKED

- 公開前にcode修正が必要 → `IMPLEMENTATION`
- 仕様矛盾 → `REQUIREMENTS`
- GitHub操作や環境の原因不明失敗 → `INCIDENT`
- 人間しか解消できない必須操作 → `BLOCKED`

## 出力

```text
DELIVERY
Status: PASS | FAIL | BLOCKED
Checkpoint: pr_created
Mode: create | update_existing
Task ID:
Task source:
Branch:
Commit:
PR:
Base / head:
Head SHA:
Draft:
Delivery target:
Evidence:
```

PASS後は必ず `PR_AFTERCARE` へ進む。PR作成時点でDONEへ進まない。

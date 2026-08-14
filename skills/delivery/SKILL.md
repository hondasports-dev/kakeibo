---
name: delivery
description: 選択されたRisk Profileで必要なVerification/ReviewがPASSしたheadをcommit/pushし、現在taskのPRを作成または更新してPR identityを固定する。PR公開checkpointに使う。
license: Apache-2.0
---

# Delivery Publish

## 目的

検証済みheadをGitHubへ公開し、現在taskの唯一のDelivery PRへ束縛する。

**PR作成はcheckpointでありcompletionではない。** PASS後は `PR_AFTERCARE`。

## 前提

- Spec Confidence: C1/C2
- Risk Level / selected profile記録済み
- profile-required Verification: PASS
- profile-required Code Review: PASSまたはNOT_REQUIRED
- profile-required Security Review: PASSまたはNOT_REQUIRED
- scope integrity確認済み

「Security Reviewが無いからDelivery不可」ではなく、**profile上requiredなのに未実施なら不可**とする。

## Review Evidence checker

`check-loop-evidence.mjs --require-review` は、separate review evidenceを要求するprofileで使う補助checkerである。

- R3/R4: 使用
- R1/R2: profileのreview evidence形式がcheckerと一致する場合のみ使用
- R0: separate review自体がNOT_REQUIREDなので、このcheckerを必須化しない

checkerの存在をRisk Profileより強い隠れGateにしない。

## Delivery target

- `merge_ready`: default
- `merged_cleaned`: ユーザーがmergeまで依頼した場合

`pr_created` はtargetではなくcheckpoint。

「PRを投げて」は通常 `merge_ready`。明示的に「PR作成までで止めて」の場合だけAftercare例外候補。

## Session / Task invariant

- current taskにつきDelivery PRは最大1
- 既存PRがあれば同じbranch / PRを更新
- Aftercare terminal前に別task PRを作らない

## Publish前確認

- intended diffのみ
- untracked / local-only / secretなし
- baseとの差分に他task変更なし
- published headがprofile-required Verification/Review済みheadと一致
- Risk escalation後に旧profileのEvidenceを流用していない

## Commit / Push

- task branch
- intended filesのみ
- push後にremote head SHAを確認

## PR create / update

PRには最低限:

- 変更内容 / 理由
- Spec Confidence / Risk / Profile
- Verification evidence
- required Review evidence
- residual risk / follow-up
- Issueまたはtask source

## Gate

PASS条件:

- intended changes committed / pushed
- current taskのDelivery PRが1つ
- PR metadata確認済み
- PR head == published verified head
- profile-required gatesが満たされている

CI / external reviewのterminal判定は `PR_AFTERCARE` が所有する。

## 出力

```text
DELIVERY
Status: PASS | FAIL | BLOCKED
Spec confidence:
Risk / profile:
Checkpoint: pr_created
Mode: create | update_existing
Branch:
Commit:
PR:
Head SHA:
Delivery target:
Required review evidence:
Evidence:
```

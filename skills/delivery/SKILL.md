---
name: delivery
description: Verification/required Review済みcontentを現在taskの唯一のPRへpublishし、preview向けPR identityを固定する。PR作成はcheckpointでありcompletionではない。
license: Apache-2.0
---

# Delivery

## 前提

- Spec Confidence C1/C2
- Workspace Preflight PASS / documented exception
- max observed Risk floorを満たすVerification
- required Controls実施済み
- required REVIEW PASS / NOT_REQUIRED
- blocking findingsなし
- required Human Gate承認済み
- scope integrity確認済み

## Suzumemo delivery

default base:

```text
preview
```

default target:

```text
merge_ready
```

`pr_created` はcheckpoint。

## PR invariant

- current taskにつきDelivery PRは最大1
- 既存PRがあれば同じbranch / PRを更新
- 他task差分を混ぜない

## Publish前

- intended diffのみ
- secret / `.env.local` / local artifactなし
- base `preview` との差分確認
- published contentがVerification/Review対象contentと対応
- open/fix_now findingなし

## PR body

最低限:

- 変更内容 / 理由
- Spec Confidence / Risk / Required Controls
- Verification
- required Review
- Findings / follow-up
- task source

Gate名を埋めるためだけの長いEvidence転記はしない。

## Revision evidence

commit SHAを記録し、可能ならtree SHAも記録する。

same tree/contentなら既存Verification/Reviewを再利用できる。

## PASS

- intended changes published
- current taskのDelivery PRが1つ
- base/headが正しい
- blocking findingsなし
- Aftercareへ進める

CI / review / mergeabilityのterminal判定はPR Aftercareが所有する。

## 出力

```text
DELIVERY
Status: PASS | BLOCKED
Branch:
Commit / tree:
PR:
Base: preview
Delivery target:
Evidence:
```

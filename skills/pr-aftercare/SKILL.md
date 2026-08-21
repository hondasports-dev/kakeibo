---
name: pr-aftercare
description: PR公開後、latest contentのCI・review・requested changes・conflict・mergeabilityを追跡し、必要なdeltaだけ再検証してmerge-readyまで収束させる。
license: Apache-2.0
---

# PR Aftercare

## 目的

PR作成で止まらず、latest PR contentを実際にmerge-readyへ収束させる。

Aftercareは主にGitHub state確認であり、multi-agent reviewを増やす工程ではない。

## 毎cycle

- PR / base / head
- latest commit SHA
- 可能ならtree/content identity
- required checks
- human/bot actionable findings
- requested changes
- approval
- conflict / mergeability
- Draft / ready state

`pending / queued / in_progress` はPASSではない。

## Draft / ready

Draft中のbot skipを「findingなし」のEvidenceにしない。

Draft → ready後はreview state / comments / threads / review checksを再観測する。

## Head change

SHAが変わっただけで全工程を再実行しない。

### same tree/content

- previous Verification / Review reuse可
- GitHub側のlatest observationだけ更新

### content changed

- delta Verification
- REVIEWがrequiredだったtaskはdelta Review
- protected behavior / AC / Risk / Controlsが変わる、またはdeltaをboundできない → affected scope full rerun

その後、同じPRへpublishして最新contentのCIを確認する。

## Finding

review/CI findingは共通 `findings[]` に追加する。

- fixed → implementation + required delta verification/review
- rejected / not_applicable → evidence
- protected accept → Human Gate
- test gap → fix or Requirements reassessment

Reviewer同士を討論させない。

## Risk escalation

Aftercareで新しいauth/data/financial/shared/external impactが判明したらPREPAREへ戻り、Risk / Controls / Verification planを更新する。

## Merge-ready

- current taskの唯一のPR
- non-draft（明示Draft運用を除く）
- latest contentのrequired checks success
- blocking findingsなし
- requested changesなし
- required approval satisfied
- conflictなし
- mergeable

## Explicit publish-only

ユーザーが明示的に「PR作成まで」「CI待ちは不要」と指定した場合だけAftercare NOT_REQUIRED可。

単なる「PR投げて」はmerge_ready。

## 出力

```text
PR AFTERCARE
Status: PASS | BLOCKED | NOT_REQUIRED
PR:
Observed revision:
Checks:
Review findings:
Requested changes:
Approval:
Conflict:
Mergeable:
Delta revalidation:
Blockers:
Evidence:
```

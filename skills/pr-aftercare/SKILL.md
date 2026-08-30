---
name: pr-aftercare
description: PR公開後、latest contentのCI・review・requested changes・approval・conflict・mergeabilityを追跡し、必要なdeltaだけ再検証してmerge-readyまで収束させる。
license: Apache-2.0
---

# PR Aftercare

## 目的

PR作成で止まらず、latest PR contentを実際にmerge-readyへ収束させる。

Aftercareは主にGitHub state確認であり、multi-agent reviewを増やす工程ではない。

## 毎cycle

観測対象を1つのrevisionへ束縛する。

- PR / base / head
- observed commit SHA
- observed tree SHA
- required checks
- human/bot actionable findings
- requested changes
- approval
- conflict / mergeability
- Draft / ready state

checks / review / approval / conflict / mergeabilityのEvidenceは、どのobserved revisionに対するものか分かる形で記録する。

`pending / queued / in_progress` はPASSではない。

レビュー結果は、利用するレビューサービス名に依存しないsnapshotへ正規化する。
`reviewed_head_sha`、`collection_status: complete`、stableな`findings[].id`と
`findings[].actionable`を記録し、current headとの一致を確認する。snapshotが欠落・未完了・
古い場合、またはactionable findingがFinding Ledger / Process Learningへstable IDで紐付かない場合は
AftercareをPASSにしない。

## Draft / ready

Draft中のbot skipを「findingなし」のEvidenceにしない。

Draft → ready後はreview state / comments / threads / review checksを再観測する。

## Head change

SHAが変わっただけで全工程を再実行しない。ただしsame contentの再利用にはtree identityの証明が必要。

### same tree/content

次をすべて満たす時だけprevious Verification / Reviewを再利用できる。

- previous tree SHAが非空
- current tree SHAが非空
- previous tree SHA == current tree SHA

この場合はGitHub側のlatest observationだけ更新する。

### identityを証明できない / content changed

- tree SHAが欠落、または一致を証明できない → content changedとして扱う
- delta Verification
- REVIEWがrequiredだったtaskはdelta Review
- protected behavior / AC / Risk / Controlsが変わる、またはdeltaをboundできない → affected scope full rerun

その後、同じPRへpublishして最新contentのCIを確認する。

## Finding Ledger

review / CI / human findingは共通 `findings[]` の同じrecordを更新する。

各recordに最低限:

- stable `id`
- `source`
- `observed_revision`（commit SHA + tree SHA）
- `status` / `disposition`
- `evidence`

を保持する。

同じfindingが次cycleでも残る場合、新しいduplicate recordを作らず同じstable IDを更新する。

遷移例:

- fixed → 同じrecordへresolution / verified_revision / evidenceを追記し、検証後にresolved
- rejected / not_applicable → 同じrecordへrationale / evidenceを追記
- protected accept → 同じrecordへHuman Gate approvalを記録
- test gap → 同じrecordをfixまたはRequirements reassessmentまでopenのまま保持

旧revisionのfindingを単に削除せず、現revisionでoutdated / not_applicableになった根拠を同recordへ残す。

レビュー結果を再利用できない場合も、Process Learningへ`no_change`とrationale / evidenceを残す。

Reviewer同士を討論させない。

## Risk escalation

Aftercareで新しいauth/data/financial/shared/external impactが判明したらPREPAREへ戻り、Risk / Controls / Verification planを更新する。

## Merge-ready

PASS直前にrevision consistencyを再確認する。

- GitHubのcurrent PR head commit SHA == recorded observed commit SHA
- current tree SHA == recorded observed tree SHA
- latest contentのrequired checks success
- required review / requested changes / approval / conflict / mergeabilityが同じobserved revisionに対するEvidence
- blocking findingsなし
- requested changesなし
- required approvalがある場合 `approval_status: pass`
- required approvalがない場合 `approval_status: not_required` 可
- conflictなし
- mergeable
- non-draft（明示Draft運用を除く）

revision不一致、tree identity不明、approval pending/block、またはEvidenceのrevisionを特定できない場合はPASSにせず、BLOCKEDまたはdelta/full再検証へ戻る。

## Explicit publish-only

ユーザーが明示的に「PR作成まで」「CI待ちは不要」と指定した場合だけAftercare NOT_REQUIRED可。

単なる「PR投げて」はmerge_ready。

## 出力

```text
PR AFTERCARE
Status: PASS | BLOCKED | NOT_REQUIRED
PR:
Observed commit / tree:
Revision consistency:
Checks:
Review findings:
Requested changes:
Approval required:
Approval status:
Conflict:
Mergeable:
Delta revalidation:
Blockers:
Evidence:
```

---
name: code-review
description: REVIEW stageを所有し、Risk/Controlsが要求する時だけ独立レビューを行う。通常最大1 reviewerでcorrectness/security/test/scopeをまとめて確認し、findingsを単一Ledgerへ追加する。
license: Apache-2.0
---

# REVIEW

## 起動条件

- R0: 原則NOT_REQUIRED
- R1: Controlが独立reviewを要求した時だけ
- R2: 1 independent reviewer
- R3: 1 independent risk-aware reviewer
- R4: 1 independent reviewer + Human Gate
- Implementationでmaterial new riskを発見した場合

default independent reviewerは最大1体。

R4またはmaterially distinct specialtyが必要な場合だけspecialistを追加できる。

## Discussion policy

- reviewersは独立して読む
- reviewer-to-reviewer debateはしない
- rootが1回だけ統合する
- Main/rootの自己確認をrequired independent reviewに数えない

## Rubric

- Acceptance Criteria / scope
- correctness / boundary / error
- async / race / stale state
- caller compatibility
- shared state
- test adequacy
- maintainability / obvious performance
- security quick rubric
- financial/data integrity whenControlがある

Frontendではloading / empty / error / a11y / navigation / state propagation。

Convexではvalidator、membership/auth前提、index/collect/OCC、caller contract。

## Security

通常はこのREVIEW内のsecurity rubricで確認する。

security controlが起動した場合だけ `skills/security-review/SKILL.md` を追加する。Securityを別serial Gateとして常に挟まない。

## Finding Ledger

所見があれば `task-state.findings[]` にstable IDで直接追加する。

同じfindingを:

- review findings
- security residual
- risk reconciliation residual

へコピーしない。

reviewer recommendationはfinal dispositionではない。rootが同じrecordのdispositionを更新する。

Must-fixは `fix_now`、未解決は `open`。

## Revision

reviewed revisionを記録する。

content change後:

- delta review
- protected behavior / AC / Risk / Controls change、またはdeltaをboundできない → affected scopeをfull review

SHAだけ変わりtree/contentが同じなら再レビュー不要。

## 出力

```text
REVIEW
Status: PASS | BLOCKED | NOT_REQUIRED
Revision:
Required by:
Reviewer:
Coverage:
Findings added:
Security specialist: used | not_required
Evidence:
```

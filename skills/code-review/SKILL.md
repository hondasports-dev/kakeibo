---
name: code-review
description: REVIEW stageを所有し、Risk/Controlsが要求する時だけ独立レビューを行う。compact contract・diff・Coverage Mapを使い、仕様/要件/test caseの漏れを先に探してからcorrectness/securityを確認する。R4だけを理由にHuman Gateやreviewer追加を行わない。
license: Apache-2.0
---

# REVIEW

## 起動条件

- R0: 原則NOT_REQUIRED
- R1: Controlが独立reviewを要求した時だけ
- R2: 1 independent reviewer
- R3: 1 independent risk-aware reviewer
- R4: 1 independent risk-aware reviewer
- Implementation / Verificationでmaterial new riskを発見した場合

default independent reviewerは最大1体。

R4 classificationだけを理由にspecialistや追加reviewerを増やさない。materially distinctなRequired Controlが別専門性を要求する場合だけspecialistを追加できる。

Human Gateはreview stageのRisk labelではなく、unresolved material choice、production/irreversible operation、protected finding acceptance等の具体的triggerへ束縛する。

## Delegation

reviewer delegationは独立coverage改善にmaterially効く場合だけ使う。

- reviewerはread-only
- reviewer-to-reviewer debateはしない
- rootが1回だけ統合する
- Main/rootの自己確認をrequired independent reviewに数えない
- 同じ観点を複数reviewerへ重複依頼しない

## Compact review packet

Reviewerへ渡すdefault inputは次だけ。

- AC / IV IDと短いcontract文
- relevant dimensions / material assumptions
- impact summary / Risk / Required Controls
- behavior-changing diff / behavior change map
- Coverage Map / TC結果 / Verification Evidence
- open Finding IDs
- reviewed revision

Issue全文、chat履歴、全Skill、全repoを毎回渡さない。

Reviewerが具体的なconflict / missing caller / missing boundaryを示した場合だけ該当sourceへ追加探索する。

## Review order

### 1. Omission scan

styleや細かい実装論より先に、contract漏れを確認する。

- AC / IVにimplementation surfaceが無いものはないか
- AC / IVにVerification Evidenceが無いものはないか
- behavior-changing diffにAC / IV / design deviationの対応が無いものはないか
- PREPAREでrelevantとしたdimensionのtest caseが抜けていないか
- happy pathだけでboundary / denial / failureが抜けていないか
- Preserve対象を壊すcaller / serializer / validator / persistence経路がないか
- current task scope外のbehavior changeが混入していないか

materialな漏れだけfindingにする。単なる「念のため全部追加」はしない。

### 2. Correctness / boundary

- correctness / boundary / error
- async / race / stale state
- caller compatibility
- shared state
- data / state transition
- test adequacy

reversible / low-impact変更でimplementation detailを鏡写しするだけのtest追加をreview findingにしない。observable AC/IVの未証明がある場合だけtest gapとして扱う。

### 3. Domain rubric

Required Controlがある領域だけ深掘りする。

- security / auth / ownership
- financial / data integrity
- destructive / idempotency / recovery

### 4. Maintainability / performance / UX

materialな場合だけ。

Frontendではloading / empty / error / a11y / navigation / state propagation。

Convexではvalidator、membership/auth前提、index/collect/OCC、caller contract。

## Requirements gap / Test gap

Reviewerは区別する。

- 必要behaviorがAC/IVに無い → `requirements_gap`。PREPAREへ戻す
- AC/IVはあるがEvidenceが無い → `test_gap`

reviewer自身が新仕様を暗黙に決めない。

## Security

通常はこのREVIEW内のsecurity rubricで確認する。

security controlが起動した場合だけ `skills/security-review/SKILL.md` を追加する。Securityを別serial Gateとして常に挟まない。

R4だけではsecurity specialistを追加しない。

## Mid-turn / revision

review中にユーザー指示またはcontent changeが入った場合、unaffected finding/Evidenceを無条件に捨てない。

- same tree/content → previous Review再利用可
- bounded delta → delta review
- protected behavior / AC / Risk / Controls change、またはdelta unbounded → affected scope full review

SHAだけ変わりtree/contentが同じなら再レビュー不要。

## Finding Ledger

所見があれば `task-state.findings[]` にstable IDで直接追加する。

同じfindingをreview findings / security residual / risk reconciliation residualへコピーしない。

reviewer recommendationはfinal dispositionではない。rootが同じrecordのdispositionを更新する。

Must-fixは `fix_now`、未解決は `open`。

protected finding acceptanceだけは具体的なHuman Gate trigger。R4や一般的なrisk concernだけでapprovalを要求しない。

## 出力

AC本文やsource本文を再掲せず、IDとfindingだけを中心にする。

```text
REVIEW
Status: PASS | BLOCKED | NOT_REQUIRED
Revision:
Required by:
Reviewer:
Omission scan: PASS | BLOCKED | NOT_REQUIRED
Coverage checked: AC/IV IDs
Findings added:
Security specialist: used | not_required
Human Gate trigger: none | <specific trigger>
Evidence:
```

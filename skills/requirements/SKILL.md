---
name: requirements
description: ユーザー要求、Issue、docs、tests、既存実装を統合し、Spec Confidenceを確定したうえでRisk LevelとLoop Profileを選ぶ。実装前の仕様確定とrisk-based routingに使う。
license: Apache-2.0
---

# Requirements / Specification / Risk Routing

## 目的

このSkillは「何を作るか」と「どれだけ重いループを使うか」を決める。

**仕様不明と変更リスクを混同しない。**

1. Spec Confidenceを確定する
2. Acceptance Criteriaとscopeを作る
3. Riskを判定する
4. Loop Profileを選ぶ

`C0` のままImplementationへ進まない。

## 1. Spec Confidence

### C2 confirmed

- 目的・期待結果・主要Acceptance Criteriaが明確
- materialな仕様sourceが矛盾しない

### C1 reconstructed

Issue等に不足はあるが、canonical docs、tests、既存pattern等から成果物をほぼ一意に補完できる。

局所的な命名や既存patternの踏襲はMainが補完してよい。

### C0 unclear

複数の妥当な仕様があり、選択でユーザー体験・data意味・権限・完了条件が変わる。

→ Requirements Discoveryを続ける。解消しなければHuman Gate。

### C0 conflicted

望ましい最終状態について有力なsource同士が矛盾する。

→ Source reconciliation。解消しなければHuman Gate。

## 2. Source reconciliation

Evidenceは次の順で確認する。

1. 現在のユーザー指示
2. 最新の明示承認仕様 / ADR / decision
3. 現在taskのIssue・コメント
4. canonical docs
5. tests
6. implementation / existing pattern

ただし、Issueが「現在BをAへ変更する」と明示しているなら、既存実装Bとの差はConflictではなくexpected delta。

次のような場合は自動でどちらかを選ばない。

- Issue A / approved spec B
- Issue A / docs・tests・implementation B だがIssueがintentional changeかstaleか不明
- data保持、認可、課金、削除等で複数の妥当な最終状態がある

Human Gateへ渡す時は、各source、更新時点、差分、成果物への影響を示す。

## 3. Scope / Acceptance Criteria

最低限:

- Goal
- Current behavior
- Expected behavior
- In scope
- Out of scope
- Preserve
- Acceptance Criteria
- edge / error state
- Test Strategy

R0/R1では必要十分な短いpacketでよい。テンプレを埋めるためだけに不要な項目を増やさない。

## 4. Risk判定

Spec ConfidenceがC1/C2になってから確定する。

4軸を `0..2` で記録する。

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安:

- `0..2` → R1
- `3..4` → R2
- `5..8` → R3

R0 / R4は明示条件。

### R3 floor

- authn / authz
- tenant / group / data boundary
- schema / migration
- data deletion / retention
- billing / payment
- privileged secret / env
- webhook / external service write
- production behavior config

### R4 critical

- production DB migration
- bulk / irreversible data mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS / domain cutover

process policyは一律Highにしない。通常R2、safety / Delivery completion / production-destructive policy変更はR3+。

## 5. Profile選択

### R0 trivial

- independent review: 0
- separate Impact: no
- separate Code Review: no
- separate Security Review: no

### R1 fast

- independent review: 0
- Impactはこのpacketの`impact_summary`へ統合
- Code Reviewでsecurity quick scan

### R2 standard

- independent review: 0が既定
- 次の時だけ1 review:
  - C1
  - material uncertainty
  - cross-cutting change
  - Mainがmaterial ambiguityを検出
- post-synthesis review: 0
- separate Impact: yes

### R3 high

- independent review: 2
- separate Impact / Code Review / Security Review

### R4 critical

- independent review: 3
- post-synthesis review: 1
- implementation前Human Gate
- production / irreversible operation前Human Gate

## 6. Independent Review契約

R2-R4でreviewが必要な時だけ使う。

- 同じimmutable input snapshotを使う
- reviewerはread-only
- Mainの結論や他reviewerの結果を提出前に見せない
- Mainはreview人数に数えない
- revisionが変わったら影響するreviewをinvalidにする

**R0/R1へmulti-agent reviewを追加して安全性を水増ししない。** 新しい不確実性を見つけたならRiskまたはSpec Confidenceを再判定する。

## 7. Risk再評価

Riskは最初の分類で固定しない。

- 新しいcaller / shared state / auth / data / external impact発見 → 即時昇格
- 低下 → 実装前にEvidence付きのみ
- 実装開始後 → task中の最大Riskをcompletion floorにする

## 出力

```text
REQUIREMENTS
Status: PASS | BLOCKED
Spec confidence: C0 | C1 | C2
Expected delta:
Authoritative sources:
Conflicts:
Goal:
In scope:
Out of scope:
Acceptance criteria:
Impact summary:
Risk axes:
Risk score:
Risk floor triggers:
Risk level: R0 | R1 | R2 | R3 | R4
Selected profile: trivial | fast | standard | high | critical
Independent reviews required/completed:
Human Gate:
Evidence:
```

PASS条件はSpec ConfidenceがC1/C2で、Risk/Profileが記録されていること。

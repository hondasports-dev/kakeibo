---
name: requirements
description: PREPAREを所有し、Spec Confidence、scope、Acceptance Criteria、Risk、Required Controls、Verification planを一度だけ確定する。Riskの高さだけでRequirements reviewerを増やさない。
license: Apache-2.0
---

# PREPARE / Requirements

## 目的

実装前に「何を作るか」「何を守るか」「何を検証するか」を決める。

このSkillは次を所有する。

- Goal / In scope / Out of scope / Preserve
- Acceptance Criteria
- Spec Confidence
- Risk / max observed Risk
- Required Controls
- Verification plan
- 必要十分な Impact summary

`C0` のままImplementationへ進まない。

## Workspace Preflight

repository fileを変更するtaskでは、最初の編集前に `skills/workspace-preflight/SKILL.md` を適用する。

これは独立した長いreasoning Gateではなく、PREPARE内のcheap deterministic control。

## Spec Confidence

### C2 confirmed

目的・期待結果・主要ACが明確でmaterial conflictなし。

### C1 reconstructed

不足はあるが、authoritative docs / tests / existing patternからmaterial product choiceなしに復元できる。

### C0 unclear

複数の妥当な成果物があり、選択でUX・data意味・権限・課金・完了条件等がmaterially変わる。

→ Requirements Discovery。解消しなければHuman Gate。

### C0 conflicted

desired stateについてauthoritative source同士が矛盾する。

→ Source reconciliation。解消しなければHuman Gate。

## Source priority

1. current user instruction
2. latest explicitly approved spec / ADR / decision
3. current task Issue / comments
4. canonical docs
5. tests
6. current implementation / existing pattern

Issueが「現在BをAへ変える」と明示している場合、Bとの差はexpected deltaでありconflictではない。

## Independent Spec Review

RiskがR3/R4という理由だけで複数reviewerを起動しない。

最大1 reviewerを使うのは次だけ。

- C1復元後もmaterial choiceが残る
- 復元した仕様がauth/data/financial等のprotected behaviorを変える

Reviewer同士を討論させない。rootが1回統合する。

## Risk

4軸 `0..2`。

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

R0 / R4は明示条件。

R4代表:

- production DB/data migration
- bulk / irreversible mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS/domain cutover

Risk上昇は発見時点で即時。Implementation開始後はmax observed Riskをcompletion floorにする。

## Required Controls

Riskとは別に選ぶ。

- `workspace_preflight`
- `security_review`
- `data_model`
- `financial_integrity`
- `destructive_or_stateful`
- `service_ops`
- `human_gate`
- `prompt_injection_guard`

authやschemaに触れたという理由だけで全High ceremonyを起動せず、必要なControlを追加する。

## Impact

通常はこのpacketの `impact_summary` で十分。

`skills/impact-analysis/SKILL.md` を別途読むのは:

- cross-cutting
- shared state / callersが多い
- auth/data/schema/financial/external writeの影響が不明
- rollback/deploy impactが不明

## 出力

```text
PREPARE
Status: PASS | BLOCKED
Workspace preflight:
Spec confidence:
Authoritative sources:
Conflicts:
Goal:
In scope:
Out of scope:
Preserve:
Acceptance Criteria:
Impact summary:
Risk axes:
Risk level:
Max observed risk:
Required controls:
Verification plan:
Independent spec review:
Human Gate:
Evidence:
```

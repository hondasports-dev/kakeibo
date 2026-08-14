---
name: impact-analysis
description: R2-R4またはRisk再評価が必要な変更で、caller/callee・shared state・auth/data・tests・deploy影響を独立して確認し、confirmed Riskを更新する。R0/R1ではRequirementsのimpact summaryで代替する。
license: Apache-2.0
---

# Impact Analysis

## 適用

- R0: NOT_REQUIRED
- R1: Requirementsの`impact_summary`で代替
- R2/R3/R4: separate Gateとして実行
- R0/R1でもshared/auth/data/external impactの疑いが出たら、このGateへ昇格してRiskを再判定

## 観点

- direct change surfaces
- callers / callees
- shared state / shared component / provider
- authentication / authorization / tenant boundary
- data / schema / migration
- affected UI / user flows
- regression tests
- external service / deployment
- rollback / recovery

## Risk再評価

Requirementsのinitial Riskを検証し、confirmed Riskを記録する。

- 新しいimpact発見 → 即時Risk昇格
- R3/R4 floor trigger発見 → profileを切り替える
- downgrade → 実装前かつEvidence付きのみ

Riskを上げた場合、新profileで追加されたRequirements review / Security Review / Verification条件を必須にする。

## 出力

```text
IMPACT_ANALYSIS
Status: PASS | BLOCKED | NOT_REQUIRED
Initial risk:
Confirmed risk:
Risk escalated:
Direct changes:
Callers / callees:
Shared state:
Auth / data boundaries:
Data / schema:
Affected flows:
Regression tests:
External / deployment:
Recovery / rollback:
Evidence:
```

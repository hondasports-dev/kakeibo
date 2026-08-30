---
name: impact-analysis
description: PREPAREのimpact summaryでは安全に影響範囲をboundできない時だけ使う条件付きhelper。caller/shared state/auth/data/financial/external/deploy impactを深掘りしてRisk/Controlsを更新する。
license: Apache-2.0
---

# Impact Analysis Helper

## 使う時

defaultでは別Gateにしない。

次の場合だけ起動する。

- cross-cutting change
- shared state / multiple callers
- auth / authorization / group boundaryの影響が不明
- Convex schema / persistent data contractの影響が不明
- billing / financial integrityへの影響が不明
- external service / deploy / rollback impactが不明

## 観点

- direct change surfaces
- callers / callees
- shared provider / hook / membership helper
- authn / authz / group boundary
- data / Convex schema / persistent contract
- billing / payment / financial settlement
- affected UI / user flow
- regression tests
- Clerk / Convex / Vercel / GitHub / webhook / OAuth
- rollback / recovery

## 更新

発見した内容は新しいGate recordへ複製せず、PREPAREの:

- `impact_summary`
- Risk / max observed Risk
- Required Controls
- Verification plan

へ反映する。

Implementation開始後にRiskが上がった場合はmax observed Riskを更新し、completion floorを下げない。

## 出力

```text
IMPACT ANALYSIS
Status: PASS | BLOCKED
New impact:
Risk change:
Controls added:
Verification plan changes:
Evidence:
```

---
name: implementation
description: Spec ConfidenceとRisk Profileが確定した後、profileで要求されたRequirements/Impact Evidenceに従って最小差分を実装する。振る舞い変更やバグ修正の実装に使う。
license: Apache-2.0
---

# Implementation

## 前提

- Spec Confidenceが `C1` または `C2`
- Risk Level / selected profileが記録済み
- RequirementsがPASS
- profileがseparate Impact Gateを要求する場合だけ `IMPACT_ANALYSIS: PASS`
- R0/R1ではRequirements packetの`impact_summary`が存在
- Workspace Preflightと常時安全Skillを適用済み

## 実装契約

開始前に最低限:

```text
Goal:
Spec confidence:
Risk / profile:
Editable scope:
Out of scope:
Acceptance Criteria:
Impact summary / Impact Analysis:
Constraints:
Verification plan:
```

Issue本文だけを実装契約にしない。

## Writer境界

- 同一差分のwriterは原則1体
- 複数writerはpathを完全分離できる場合だけ
- 他taskの差分を混ぜない
- secret / `.env.local` / local artifactをcommitしない

## TDD

振る舞い変更・bug fixでは、適切ならRED/GREENを使う。

1. 仕様を証明する最小testを追加/更新
2. 期待した理由でRED
3. 最小実装
4. GREEN
5. 必要なrefactor後もGREEN

R0 docs/format等でtest不要なら理由を記録する。

## Risk / Specの再評価

実装中に次を発見したら、その場で実装範囲だけ広げない。

- material spec ambiguity → Requirementsへ戻る
- shared caller / provider影響 → Risk再評価
- auth/data/schema/external trigger → R3+へ昇格
- production/irreversible trigger → R4へ昇格

Implementation開始後はtask中のmax observed Riskがcompletion floor。

## Integrity Check

終了時にtracked/untrackedを含む差分を確認する。

- scope外変更なし
- Acceptance Criteriaと対応
- unexplained design deviationなし
- required impact対策がVerification planへ反映
- unrelated dependency/refactorなし
- secret/local-only/generated artifactなし

## 出力

```text
IMPLEMENTATION
Status: PASS | FAIL | BLOCKED
Spec confidence:
Risk / profile:
Changed files:
RED evidence:
GREEN evidence:
Design deviations:
Impact changes discovered:
Risk escalation:
Unresolved items:
Integrity check:
Evidence:
```

---
name: code-review
description: Verification後、Risk Profileに応じて差分の正しさ・回帰・保守性・テスト妥当性をレビューし、R1/R2ではSecurity quick scanも同時に行う。Delivery前の品質判定に使う。
license: Apache-2.0
---

# Code Review

## 目的

変更差分を実装時の自己確認とは分けて見直す。ただし、低〜中リスク変更でCode ReviewとSecurity Reviewを毎回別LLM工程にしない。

## Profile別

### R0

separate Code Reviewは原則NOT_REQUIRED。targeted checkとdiff integrityで十分な理由を記録する。

### R1

1回のreviewで次を確認する。

- Acceptance Criteria
- correctness / edge / regression
- test adequacy
- scope integrity
- **Security quick scan**

### R2

R1より広いcaller / shared surfaceを確認する。Security quick scanでR3 floor triggerを発見したらRiskをR3へ上げ、独立Security Reviewを要求する。

### R3 / R4

full Code Reviewとして実行し、Securityは次の独立Gateへ渡す。

## 共通観点

- 目的・scopeとの一致
- null / empty / boundary / error
- async / race / stale state
- API / type / schema contract
- caller compatibility
- maintainability / unnecessary abstraction
- performance上の明らかな問題
- changed testsが仕様を実際にassertしているか

Frontendではloading / empty / error / a11y / navigation / state propagationを必要に応じて見る。
Convexではvalidator、membership/auth前提、index / collect / OCC、caller contractを必要に応じて見る。

## Security quick scan（R1/R2）

別Security Reviewを起動する前の軽量screen。

- authn / authz / membership条件を変更していないか
- tenant / group / user data boundaryへ影響しないか
- user-controlled input / HTML / URL / redirect等を新しく扱わないか
- secret / privileged envへ触れないか
- external service write / webhookを増やさないか
- destructive / production behaviorを変えないか

1つでもR3 floor triggerが見つかったら `security_quick_scan: escalate` とし、Riskを再分類する。quick scanだけでR3変更をPASSさせない。

## Review independence

- 実装メモをそのままReview Evidenceへ流用しない。
- 対象head SHAを固定する。
- 同一sessionでも実装完了後に別のreview passとして実行すればよい。
- R3/R4でprofileが独立reviewerを要求する場合はその契約に従う。

低Riskで「別Agentを起動した」という事実だけを品質Evidenceにしない。

## FAIL

Must-fixがあれば:

```text
CODE_REVIEW FAIL
→ IMPLEMENTATION
→ profile-required VERIFICATION
→ CODE_REVIEW
```

Risk escalationを伴う場合はRequirements / Impactへ戻ってprofileを更新する。

## 出力

```text
CODE_REVIEW
Status: PASS | FAIL | NOT_REQUIRED
Risk level:
Profile:
Reviewed head SHA:
Reviewed scope:
Must-fix:
Nice-to-have:
Regression risks:
Test adequacy:
Security quick scan: PASS | ESCALATE | NOT_REQUIRED
Security escalation reason:
Integrity check:
Evidence:
```

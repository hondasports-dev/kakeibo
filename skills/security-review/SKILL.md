---
name: security-review
description: R3/R4またはSecurity quick scanで昇格した変更に対して、auth・data boundary・input・secret・external service・destructive operationを独立Gateとして確認する。高リスク変更のDelivery前に使う。
license: Apache-2.0
---

# Security Review

## 適用

このSkillは**全変更で毎回起動しない**。

### Required

- Risk `R3 high`
- Risk `R4 critical`
- R1/R2のCode Review quick scanでR3 floor triggerを発見した場合

### NOT_REQUIRED可能

- R0
- R1
- R2でsecurity/data/production/destructive floor triggerがなく、Code ReviewのSecurity quick scanがPASS

NOT_REQUIRED理由をEvidenceへ残す。

## 目的

高リスク差分について、機能的な正しさとは別にsecurity / data / operational boundaryを確認する。

## 観点

### Authentication / Authorization

- 未ログイン・未所属・権限不足
- membership / ownership / admin等のserver-side enforcement
- client supplied userId / groupId等を信用していないか
- tenant / group越境

### Data Boundary / Privacy

- 他user / group data混入
- unnecessary PII / 家計情報露出
- delete / archive / retention / audit
- migration compatibility

### Input / Injection

- public input validation
- HTML / URL / redirect / filename
- shell / query / command construction
- error messageによる情報露出

### Secrets / Environment

- `.env.local` / API key / tokenをcommitしない
- server secretをclientへ露出しない
- dev / preview / productionを混同しない

### External Service / Webhook

- signature / origin / CSRF等の必要条件
- retry / idempotency
- unintended production write

### Destructive / Production

- scope
- rollback / recovery
- duplicate execution
- Human Gate

R4ではproduction / irreversible operation直前のHuman GateがPASSしていることを確認する。

## Risk escalation

Review中にR4 critical triggerを発見したらSecurity Reviewだけを重くして済ませない。Requirementsへ戻し、RiskをR4へ昇格してHuman Gate / recovery evidenceを追加する。

## FAIL

```text
SECURITY_REVIEW FAIL
→ IMPLEMENTATION
→ profile-required VERIFICATION
→ CODE_REVIEW
→ SECURITY_REVIEW
```

仕様判断が必要ならRequirements、原因不明ならIncidentへ戻る。

## 出力

```text
SECURITY_REVIEW
Status: PASS | FAIL | NOT_REQUIRED | BLOCKED
Risk level:
Reviewed head SHA:
Authentication:
Authorization:
Data boundary / privacy:
Input / injection:
Secrets:
External services:
Destructive / production:
Must-fix:
Residual risks:
Human Gate status:
Evidence:
```

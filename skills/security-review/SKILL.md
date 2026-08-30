---
name: security-review
description: security_review Controlが起動した時だけREVIEW stageへ追加するspecialist helper。auth、group/data boundary、input、secret、webhook/external write、production effectを確認する。
license: Apache-2.0
---

# Security Review Helper

## Required when

- authentication / authorization変更
- tenant / group / user data boundary変更
- privileged env / secret boundary変更
- user-controlled HTML / URL / redirect / file / MIME
- webhook / external write boundary変更
- main reviewerがsecurity specialistを要求

Risk R3/R4という理由だけで自動起動しない。逆にRisk R1/R2でも上記Controlがあれば起動する。

## 観点

### Auth / Authorization

- unauthenticated / unauthorized / non-member
- membership / ownership / admin server-side enforcement
- client supplied userId/groupIdを信用していないか
- cross-user / cross-group isolation

### Data / Privacy

- 他user/group data混入
- unnecessary household data / PII exposure
- delete / archive / retention / audit

### Input

- public input validation
- HTML / URL / redirect / filename
- command/query construction
- error leakage

### Secrets / External

- `.env.local` / token / API key
- server secretのclient露出
- webhook signature/origin/CSRF
- retry / idempotency
- unintended production write

### Destructive / Production

- scope
- rollback / recovery
- duplicate execution
- Human Gate

## Finding Ledger

所見は共通 `findings[]` へ直接追加する。`security_review.residual_risks` 等の別recordを作らない。

新しいsecurity findingにはstable IDを払い出し、最低限次を保持する。

- `id`
- `source: security_review`
- `observed_revision`（commit SHA + tree SHA）
- `status` / `disposition`
- `evidence`

再レビューで同じfindingを確認した場合はduplicate recordを作らず、同じstable IDのentryへ最新revision / evidence / dispositionを追記する。

protected findingはagent単独defer不可。

## 出力

```text
SECURITY REVIEW
Status: PASS | BLOCKED
Revision:
Coverage:
Finding IDs added/updated:
Human Gate:
Evidence:
```

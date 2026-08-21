---
name: verification
description: Acceptance Criteria、max observed Risk、Required Controlsに対応する最小十分な検証を行い、test gapをFinding Ledgerへ記録する。
license: Apache-2.0
---

# Verification

## 原則

「全部実行した」ではなく、**ACとrequired boundaryを証明した**ことをPASS条件にする。

テストを追加したことと、実行してPASSしたことは別。

## Profile

### R0

- diff / format / targeted static check
- behavior不変ならruntime test NOT_REQUIRED理由

### R1

- changed / directly affected tests
- scopeable lint / type / build
- browser ACがあればfunctional E2E

### R2

- affected unit/component/Convex/integration tests
- shared caller regression
- browser ACのfunctional E2E

### R3

R2に加え、affected scopeの:

- normal / boundary / error
- auth denial / group isolation
- partial failure
- data / state transition compatibility

### R4

R3 + rollback / recovery evidence + Human Gate precondition。

## Required Controls

### Security

auth / authorization / group boundary変更なら、許可経路だけでなくdenial / cross-user・cross-groupを検証する。

### Data model

Convex schema / shared membership helper変更なら、affected query / mutation / callerを検証する。

`getGroupMembership`、`resolveActiveGroupForUserId`、`getResolvedMemberships`等のshared helper変更はfeatureのtargeted testだけで終えない。

### Financial integrity

billing/payment/settlement変更は境界値、二重実行、失敗経路、整合性を検証する。

### Destructive/stateful

delete/retention/state transition/idempotency変更はfailure pathとrecoveryを確認する。

## Suzumemo E2E environment

browser ACがある場合は既存手順を使う。

```bash
pnpm run e2e:env-sync
```

Convex反映が必要なら:

```bash
pnpm exec convex dev --once
```

secret / `.env.local` の値は、次のどこにも表示・送信・保存・commitしない。

- shell command / test commandの引数・標準出力
- local / CI log
- CI artifact / trace / screenshot / HAR
- PR / Issue / chat
- 外部サービスへの不要なrequest
- tracked file / commit

secretを含む可能性がある出力はmaskして扱う。必要な検証を安全にmaskできない場合はskipせずBLOCKEDとし、別の検証方法または環境復旧を選ぶ。

required environment unavailable / env sync failure / Convex reflection failureはskip理由ではない。復旧またはBLOCKED / Incident。

## CIとの分担

同一contentのrepo-wide full checks / regression E2EはCI Aftercareを正本にできる。

localで同じfull suiteを重ねる場合は理由を記録する。

盲目的retryをしない。失敗原因を分類し、修正deltaに依存するcheckだけを再実行する。

## Test Gap

ACやrequired invariantを証明できない場合は `findings[]` にrecordを追加する。

新しいtest gapにはstable IDを払い出し、最低限:

- `id`
- `source: verification`
- `observed_revision`（commit SHA + tree SHA）
- `category: test_gap`
- `status: open`
- `disposition: open` または `fix_now`
- `evidence`

を保持する。

Verification再実行で同じgapが残る場合はduplicate recordを作らず、同じstable IDのentryへ最新revision / evidenceを追記する。

別のmaterial_test_gap表やresidual recordへ転記しない。

test gapが残る間VerificationはPASS不可。Human Gateで迂回しない。

## Revision change

previous evidenceをsame contentとして再利用するには、previous/current双方の非空tree SHA一致を必須とする。

- matching tree SHA → previous evidence reuse可
- tree identity不明 → content changedとしてdelta/full再検証
- content changed → delta verification
- protected behavior / AC coverage / Risk / Controls changed、またはdeltaをboundできない → affected scopeをfull rerun

## 出力

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Revision commit / tree:
Affected scope:
Acceptance Criteria results:
Checks:
Skipped + reason:
Reruns + reason:
Finding IDs added/updated:
Evidence:
```
